import { createPartFromText, createPartFromUri, createUserContent } from "@google/genai";
import { getGeminiClient } from "./client";
import { GEMINI_MODEL, GENERATION_DEFAULTS } from "./config";
import { deleteMaterial, uploadMaterial } from "./files";
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

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg);
}

/**
 * 講義資料 または 過去問（1ファイル）から問題セットを生成する。
 *
 * 1. ファイルを Files API にアップロード
 * 2. ファイル参照 + プロンプトで generateContent（構造化 JSON 出力）
 * 3. 後片付けとしてアップロードファイルを削除
 */
export async function generateQuestions(
  material: MaterialInput,
  options: GenerateQuestionsOptions = {},
): Promise<QuestionSet> {
  const uploaded = await uploadMaterial(
    material.blob,
    material.mimeType,
    material.fileName ?? "material",
  );

  try {
    const prompt = buildQuestionPrompt(options);

    const contents = createUserContent([
      createPartFromUri(uploaded.uri, uploaded.mimeType),
      createPartFromText(prompt),
    ]);

    const ai = getGeminiClient();
    let response;
    try {
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          temperature: GENERATION_DEFAULTS.temperature,
          responseMimeType: "application/json",
          responseSchema: questionSetResponseSchema,
        },
      });
    } catch (err) {
      if (isRateLimit(err)) throw new GeminiRateLimitError();
      throw err;
    }

    return sanitizeFigures(parseQuestionSet(response.text));
  } finally {
    await deleteMaterial(uploaded.name);
  }
}
