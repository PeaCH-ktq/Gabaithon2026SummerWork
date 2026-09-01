import {
  ALLOWED_MATERIAL_MIME_TYPES,
  MAX_MATERIAL_BYTES,
} from "@/lib/gemini/config";
import {
  GeminiRateLimitError,
  GeminiUnavailableError,
  generateQuestions,
  type MaterialInput,
} from "@/lib/gemini/generateQuestions";
import { createClient } from "@/lib/supabase/server";

// Gemini SDK + ファイル処理のため Node ランタイムを使う。
export const runtime = "nodejs";
// アップロード〜生成で時間がかかるため延長（対応プラットフォームのみ有効）。
export const maxDuration = 60;

const ALLOWED_MIME: readonly string[] = ALLOWED_MATERIAL_MIME_TYPES;

type StoredMaterial = {
  storage_path: string;
  file_name: string;
  mime_type: string;
};

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

async function materialFromDatabase(materialId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: bad("ログインが必要です。", 401) } as const;

  const { data, error: rowError } = await supabase
    .from("materials")
    .select("id, storage_path, file_name, mime_type")
    .eq("id", materialId)
    .single();
  if (rowError || !data) return { error: bad("指定された資料が見つかりません。", 404) } as const;
  const row = data as unknown as StoredMaterial;
  if (!ALLOWED_MIME.includes(row.mime_type)) return { error: bad("指定された資料のファイル形式は未対応です。") } as const;

  const { data: blob, error: downloadError } = await supabase.storage.from("materials").download(row.storage_path);
  if (downloadError || !blob) {
    console.error("[questions/generate] material download", downloadError);
    return { error: bad("資料ファイルを読み込めませんでした。", 502) } as const;
  }
  return { material: { blob, mimeType: row.mime_type, fileName: row.file_name } satisfies MaterialInput } as const;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("multipart/form-data で送信してください。");
  }

  const file = form.get("file");
  const materialId = String(form.get("materialId") ?? "").trim();
  let material: MaterialInput;
  if (file instanceof File && file.size > 0) {
    if (materialId) return bad("DB資料とローカルファイルは同時に指定できません。");
    const err = validateFile(file);
    if (err) return bad(err, err.includes("大きすぎます") ? 413 : 400);
    material = { blob: file, mimeType: file.type, fileName: file.name };
  } else if (materialId) {
    const result = await materialFromDatabase(materialId);
    if ("error" in result) return result.error;
    material = result.material;
  } else {
    return bad("DBの資料を選ぶか、ローカルファイルを添付してください。");
  }

  const extraInstruction = String(form.get("extraInstruction") ?? "").trim() || undefined;
  if (extraInstruction && extraInstruction.length > 1000) return bad("追加の指示は1000文字以内で入力してください。");

  try {
    const questionSet = await generateQuestions(material, { extraInstruction });
    return Response.json({ questionSet });
  } catch (e) {
    if (e instanceof GeminiRateLimitError) {
      return bad(e.message, 429);
    }
    if (e instanceof GeminiUnavailableError) {
      return Response.json(
        { error: e.message },
        { status: 503, headers: { "Retry-After": "30" } },
      );
    }
    console.error("[questions/generate]", e);
    const message = e instanceof Error ? e.message : "問題の生成に失敗しました。";
    return bad(message, 502);
  }
}
