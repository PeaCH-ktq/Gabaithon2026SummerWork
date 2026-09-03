import { createPartFromText, createPartFromUri, createUserContent } from "@google/genai";
import { getGeminiClient } from "./client";
import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  GENERATION_DEFAULTS,
  GENERATION_RETRY,
} from "./config";
import { deleteMaterial, uploadMaterial, type UploadedMaterial } from "./files";
import { validateSvg } from "@/lib/svg/validateSvg";
import { buildQuestionPrompt, type QuestionPromptOptions } from "./prompts";
import { parseQuestionSet, questionSetResponseSchema, type QuestionSet } from "./schema";

/**
 * 各問題の figure を検証し、危険 / 不正な SVG は figure ごと落とす（prompt は残す）。
 * 生成全体は失敗させない。
 */
function sanitizeFigures(set: QuestionSet): QuestionSet {
  for (const q of set.questions) {
    if (!q.figure?.svg) {
      delete q.figure;
      continue;
    }
    const safe = validateSvg(q.figure.svg);
    if (!safe) {
      console.warn("[generateQuestions] 不正な SVG を検出したため figure を除外しました");
      delete q.figure;
      continue;
    }
    q.figure.svg = safe.svg;
    q.figure.width = safe.width;
    q.figure.height = safe.height;

    // ラベルは形が整ったものだけ残す。
    if (Array.isArray(q.figure.labels)) {
      q.figure.labels = q.figure.labels.filter(
        (l) =>
          l != null &&
          Number.isFinite(l.x) &&
          Number.isFinite(l.y) &&
          typeof l.tex === "string" &&
          l.tex.length > 0 &&
          l.tex.length <= 200,
      );
      if (q.figure.labels.length === 0) delete q.figure.labels;
    }
  }
  return set;
}

/** Route Handler から渡ってくるファイル入力（講義資料 または 過去問）。 */
export interface MaterialInput {
  blob: Blob;
  mimeType: string;
  fileName?: string;
}

export type GenerateQuestionsOptions = QuestionPromptOptions;

/** Gemini のレート制限（429）を呼び出し側で判別できるようにするエラー。 */
export class GeminiRateLimitError extends Error {
  constructor() {
    super("Gemini API のレート制限に達しました。しばらく待って再試行してください。");
    this.name = "GeminiRateLimitError";
  }
}

/** 全モデルが一時的に利用できなかった場合の、利用者向けエラー。 */
export class GeminiUnavailableError extends Error {
  constructor() {
    super("問題生成サービスが混み合っています。少し待ってからもう一度お試しください。");
    this.name = "GeminiUnavailableError";
  }
}

/** 資料がモデルのコンテキスト上限を超えた場合の、利用者向けエラー。 */
export class GeminiContextExceededError extends Error {
  constructor() {
    super("資料の量が多すぎて処理できません。選択する資料を減らすか、範囲を絞った資料でお試しください。");
    this.name = "GeminiContextExceededError";
  }
}

function isContextExceeded(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /token count|context length|exceeds the maximum|too large|input is too long/i.test(msg);
}

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg);
}

function isUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b408\b|\b5\d\d\b|UNAVAILABLE|high demand|temporarily overloaded|timeout/i.test(msg);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(
  ai: ReturnType<typeof getGeminiClient>,
  model: string,
  contents: ReturnType<typeof createUserContent>,
) {
  for (let attempt = 0; attempt < GENERATION_RETRY.maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: {
          temperature: GENERATION_DEFAULTS.temperature,
          responseMimeType: "application/json",
          responseSchema: questionSetResponseSchema,
        },
      });
    } catch (err) {
      if (isContextExceeded(err)) throw new GeminiContextExceededError();
      if (isRateLimit(err)) throw new GeminiRateLimitError();
      if (!isUnavailable(err)) throw err;
      if (attempt === GENERATION_RETRY.maxAttempts - 1) throw err;

      const exponentialDelay = Math.min(
        GENERATION_RETRY.initialDelayMs * 2 ** attempt,
        GENERATION_RETRY.maxDelayMs,
      );
      const jitter = Math.floor(Math.random() * 500);
      await wait(exponentialDelay + jitter);
    }
  }
  throw new GeminiUnavailableError();
}

/**
 * 講義資料・過去問（1件以上のファイル）から問題セットを生成する。
 *
 * 1. すべてのファイルを Files API へ並列アップロード
 * 2. ファイル参照（資料ごとの見出し付き）+ プロンプトで generateContent（構造化 JSON 出力）
 * 3. 後片付けとしてアップロード済みファイルをすべて削除（成功分のみ、失敗しても無視）
 */
export async function generateQuestions(
  materials: MaterialInput[],
  options: GenerateQuestionsOptions = {},
): Promise<QuestionSet> {
  if (materials.length === 0) throw new Error("資料が指定されていません。");

  // Promise.all の結果をまとめて受け取ると、途中で reject した際に
  // 先に成功したアップロードの後片付けができなくなる。添字ごとに埋めていく。
  const uploaded: (UploadedMaterial | undefined)[] = new Array(materials.length);
  try {
    await Promise.all(
      materials.map(async (m, i) => {
        uploaded[i] = await uploadMaterial(m.blob, m.mimeType, m.fileName ?? `material-${i + 1}`);
      }),
    );

    const prompt = buildQuestionPrompt({
      ...options,
      materialNames: materials.map((m, i) => m.fileName ?? `資料${i + 1}`),
    });

    // 各ファイルの直前に見出しを挟み、モデルがどの資料かを区別できるようにする。
    const fileParts = materials.flatMap((m, i) => {
      const file = uploaded[i]!;
      return [
        createPartFromText(`【資料${i + 1}: ${m.fileName ?? "material"}】`),
        createPartFromUri(file.uri, file.mimeType),
      ];
    });
    const contents = createUserContent([...fileParts, createPartFromText(prompt)]);

    const ai = getGeminiClient();
    const models = [...new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL])];
    let response;
    for (const model of models) {
      try {
        response = await generateWithRetry(ai, model, contents);
        break;
      } catch (err) {
        if (!isUnavailable(err)) throw err;
        console.warn(`[generateQuestions] ${model} が一時的に利用できないため次のモデルを試します`);
      }
    }

    if (!response) throw new GeminiUnavailableError();

    return sanitizeFigures(parseQuestionSet(response.text));
  } finally {
    await Promise.all(
      uploaded
        .filter((u): u is UploadedMaterial => !!u)
        .map((u) => deleteMaterial(u.name)),
    );
  }
}
