import {
  ALLOWED_MATERIAL_MIME_TYPES,
  MAX_MATERIAL_BYTES,
  MAX_MATERIALS_PER_REQUEST,
  MAX_TOTAL_MATERIAL_BYTES,
} from "@/lib/gemini/config";
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
  id: string;
  shelf_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * 指定された資料IDすべてを取得・検証してから Storage を並列ダウンロードする。
 * `shelfId` は選択順の先頭（＝UI上の1件目）の棚を返す。
 */
async function materialsFromDatabase(
  supabase: SupabaseClient<Database>,
  materialIds: string[],
) {
  const { data, error: rowError } = await supabase
    .from("materials")
    .select("id, shelf_id, storage_path, file_name, mime_type, size_bytes")
    .in("id", materialIds);
  if (rowError || !data || data.length !== materialIds.length) {
    return { error: bad("指定された資料が見つかりません。", 404) } as const;
  }

  // .in() は順序を保証しないため、選択順（materialIds の並び）に戻す。
  const byId = new Map(data.map((r) => [r.id, r as unknown as StoredMaterial]));
  const rows = materialIds.map((id) => byId.get(id)!);

  for (const row of rows) {
    if (!ALLOWED_MIME.includes(row.mime_type)) {
      return { error: bad(`「${row.file_name}」のファイル形式は未対応です。`) } as const;
    }
    if (row.size_bytes > MAX_MATERIAL_BYTES) {
      return { error: bad(
        `「${row.file_name}」が大きすぎます（上限 ${Math.floor(MAX_MATERIAL_BYTES / 1024 / 1024)}MB）。`,
        413,
      ) } as const;
    }
  }
  const totalBytes = rows.reduce((sum, row) => sum + row.size_bytes, 0);
  if (totalBytes > MAX_TOTAL_MATERIAL_BYTES) {
    return { error: bad(
      `資料の合計サイズが大きすぎます（上限 ${Math.floor(MAX_TOTAL_MATERIAL_BYTES / 1024 / 1024)}MB）。`,
      413,
    ) } as const;
  }

  const downloads = await Promise.all(
    rows.map((row) => supabase.storage.from("materials").download(row.storage_path)),
  );
  const materials: MaterialInput[] = [];
  for (let i = 0; i < downloads.length; i++) {
    const { data: blob, error: downloadError } = downloads[i];
    if (downloadError || !blob) {
      console.error("[questions/generate] material download", downloadError);
      return { error: bad(`「${rows[i].file_name}」を読み込めませんでした。`, 502) } as const;
    }
    materials.push({ blob, mimeType: rows[i].mime_type, fileName: rows[i].file_name });
  }

  return { materials, shelfId: rows[0].shelf_id } as const;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("multipart/form-data で送信してください。");
  }

  // 旧クライアント互換（単数キー "materialId"）を残しつつ、複数キー "materialIds" を主とする。
  const materialIds = [
    ...new Set(form.getAll("materialIds").map((v) => String(v).trim()).filter(Boolean)),
  ];
  const legacyMaterialId = String(form.get("materialId") ?? "").trim();
  if (materialIds.length === 0 && legacyMaterialId) materialIds.push(legacyMaterialId);

  if (materialIds.length === 0) return bad("DBの資料を選んでください。");
  if (materialIds.length > MAX_MATERIALS_PER_REQUEST) {
    return bad(`参照できる資料は最大${MAX_MATERIALS_PER_REQUEST}件です。`);
  }
  const requestedShelfId = String(form.get("shelfId") ?? "").trim() || undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return bad("ログインが必要です。", 401);

  const result = await materialsFromDatabase(supabase, materialIds);
  if ("error" in result) return result.error;
  const { materials } = result;

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
    questionSet = await generateQuestions(materials, { extraInstruction });
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
    materialIds,
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
  input: { shelfId: string; materialIds: string[]; questionSet: QuestionSet },
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("question_sets")
    .insert({
      shelf_id: input.shelfId,
      owner_id: user.id,
      source_material_id: input.materialIds[0],
      source_material_ids: input.materialIds,
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
