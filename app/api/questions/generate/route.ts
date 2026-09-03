import { ALLOWED_MATERIAL_MIME_TYPES, MAX_MATERIAL_BYTES } from "@/lib/gemini/config";
import {
  GeminiContextExceededError,
  GeminiRateLimitError,
  GeminiUnavailableError,
  generateQuestions,
  type MaterialInput,
} from "@/lib/gemini/generateQuestions";
import type { QuestionSet } from "@/lib/gemini/schema";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Gemini SDK + ファイル処理のため Node ランタイムを使う。
export const runtime = "nodejs";
// Storage からの取得 → Gemini へのアップロード → ACTIVE 待ち → 生成、と
// 段階が多く、大きい資料では時間がかかるため延長する。実際の上限はプラン
// （Fluid Compute の有無）によって暗黙にクランプされることがある。
export const maxDuration = 300;

const ALLOWED_MIME: readonly string[] = ALLOWED_MATERIAL_MIME_TYPES;

type StoredMaterial = {
  shelf_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function materialFromDatabase(
  supabase: SupabaseClient<Database>,
  materialId: string,
) {
  const { data, error: rowError } = await supabase
    .from("materials")
    .select("id, shelf_id, storage_path, file_name, mime_type, size_bytes")
    .eq("id", materialId)
    .single();
  if (rowError || !data) return { error: bad("指定された資料が見つかりません。", 404) } as const;
  const row = data as unknown as StoredMaterial;
  if (!ALLOWED_MIME.includes(row.mime_type)) return { error: bad("指定された資料のファイル形式は未対応です。") } as const;
  if (row.size_bytes > MAX_MATERIAL_BYTES) {
    return { error: bad(
      `資料が大きすぎます（上限 ${Math.floor(MAX_MATERIAL_BYTES / 1024 / 1024)}MB）。`,
      413,
    ) } as const;
  }

  const { data: blob, error: downloadError } = await supabase.storage.from("materials").download(row.storage_path);
  if (downloadError || !blob) {
    console.error("[questions/generate] material download", downloadError);
    return { error: bad("資料ファイルを読み込めませんでした。", 502) } as const;
  }
  return {
    material: { blob, mimeType: row.mime_type, fileName: row.file_name } satisfies MaterialInput,
    shelfId: row.shelf_id,
  } as const;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("multipart/form-data で送信してください。");
  }

  const materialId = String(form.get("materialId") ?? "").trim();
  if (!materialId) return bad("DBの資料を選んでください。");
  const requestedShelfId = String(form.get("shelfId") ?? "").trim() || undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return bad("ログインが必要です。", 401);

  const result = await materialFromDatabase(supabase, materialId);
  if ("error" in result) return result.error;
  const { material } = result;

  // 資料が共有された雑資料（他人の棚に紐づく）の場合、生成した問題集を
  // 資料側の棚ではなく自分の棚に保存する。指定された棚を自分が所有していれば
  // それを使い、そうでなければ資料の棚にフォールバックする。
  let shelfId = result.shelfId;
  if (requestedShelfId) {
    const { data: ownedShelf } = await supabase
      .from("shelves")
      .select("id")
      .eq("id", requestedShelfId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (ownedShelf) shelfId = ownedShelf.id;
  }

  const extraInstruction = String(form.get("extraInstruction") ?? "").trim() || undefined;
  if (extraInstruction && extraInstruction.length > 1000) return bad("追加の指示は1000文字以内で入力してください。");

  let questionSet;
  try {
    questionSet = await generateQuestions(material, { extraInstruction });
  } catch (e) {
    if (e instanceof GeminiContextExceededError) {
      return bad(e.message, 413);
    }
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

  const saved = await saveQuestionSet(supabase, user, {
    shelfId,
    materialId,
    questionSet,
  });
  if ("error" in saved) {
    return Response.json({ questionSet, questionSetId: null, saveError: saved.error }, { status: 200 });
  }
  return Response.json({ questionSet, questionSetId: saved.id });
}

async function saveQuestionSet(
  supabase: SupabaseClient<Database>,
  user: User,
  input: { shelfId: string; materialId: string; questionSet: QuestionSet },
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("question_sets")
    .insert({
      shelf_id: input.shelfId,
      owner_id: user.id,
      source_material_id: input.materialId,
      title: input.questionSet.title,
      content: input.questionSet,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[questions/generate] question_sets insert", error);
    return { error: "問題集の保存に失敗しました。" };
  }
  return { id: data.id };
}
