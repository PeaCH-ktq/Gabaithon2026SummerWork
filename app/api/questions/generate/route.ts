import {
  ALLOWED_MATERIAL_MIME_TYPES,
  MAX_MATERIAL_BYTES,
} from "@/lib/gemini/config";
import {
  GeminiRateLimitError,
  generateQuestions,
  type MaterialInput,
} from "@/lib/gemini/generateQuestions";

// Gemini SDK + ファイル処理のため Node ランタイムを使う。
export const runtime = "nodejs";
// アップロード〜生成で時間がかかるため延長（対応プラットフォームのみ有効）。
export const maxDuration = 60;

const ALLOWED_MIME: readonly string[] = ALLOWED_MATERIAL_MIME_TYPES;

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function validateFile(file: File): string | null {
  if (file.size === 0) return "ファイルが空です。";
  if (file.size > MAX_MATERIAL_BYTES) {
    return `ファイルが大きすぎます（上限 ${Math.floor(MAX_MATERIAL_BYTES / 1024 / 1024)}MB）。`;
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return `ファイル形式（${file.type || "不明"}）は未対応です。対応: PDF / テキスト / PNG / JPEG / WebP。`;
  }
  return null;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("multipart/form-data で送信してください。");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return bad("講義資料または過去問のファイルを添付してください。");
  }

  const err = validateFile(file);
  if (err) return bad(err, err.includes("大きすぎます") ? 413 : 400);

  const material: MaterialInput = {
    blob: file,
    mimeType: file.type,
    fileName: file.name,
  };

  const extraInstruction = form.get("extraInstruction")
    ? String(form.get("extraInstruction"))
    : undefined;

  try {
    const questionSet = await generateQuestions(material, { extraInstruction });
    return Response.json({ questionSet });
  } catch (e) {
    if (e instanceof GeminiRateLimitError) {
      return bad(e.message, 429);
    }
    console.error("[questions/generate]", e);
    const message = e instanceof Error ? e.message : "問題の生成に失敗しました。";
    return bad(message, 502);
  }
}
