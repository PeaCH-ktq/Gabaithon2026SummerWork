import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  ALLOWED_MATERIAL_MIME_TYPES,
  MAX_MATERIAL_BYTES,
} from "@/lib/gemini/config";
import { unwrap } from "./utils";

type DB = SupabaseClient<Database>;
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type MaterialInsert = Database["public"]["Tables"]["materials"]["Insert"];

const ALLOWED_MIME: readonly string[] = ALLOWED_MATERIAL_MIME_TYPES;

/** `file.type` が空になりがちな拡張子から MIME を補完する。 */
function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "md") return "text/markdown";
  if (ext === "txt") return "text/plain";
  return file.type;
}

/**
 * Storage オブジェクトキーで安全な範囲の文字だけを残す。拡張子は保持する。
 * 日本語などの非 ASCII 文字を含むファイル名は Supabase Storage のキー制約に
 * 弾かれる（`StorageApiError: Invalid key`）ため、パスにはこちらを使う。
 * 表示用の元ファイル名は `materials.file_name` にそのまま保存する。
 */
function sanitizeForStorageKey(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";
  const safeBase = base.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "file";
  const safeExt = ext.replace(/[^A-Za-z0-9.]+/g, "");
  return `${safeBase}${safeExt}`;
}

/** 指定した棚の資料一覧（RLS により所有者本人のみ。共有はされない）。 */
export async function listMaterialsByShelf(
  supabase: DB,
  shelfId: string,
): Promise<MaterialRow[]> {
  return unwrap(
    await supabase
      .from("materials")
      .select("*")
      .eq("shelf_id", shelfId)
      .order("created_at", { ascending: false }),
    "資料の取得",
  );
}

/**
 * `materials` テーブルへの行追加のみ。
 * Storage へのアップロード本体はタスク4で `id` を採番してから呼ぶ。
 */
export async function createMaterial(
  supabase: DB,
  input: Omit<MaterialInsert, "owner_id">,
): Promise<MaterialRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  return unwrap(
    await supabase
      .from("materials")
      .insert({ ...input, owner_id: auth.user.id })
      .select()
      .single(),
    "資料の登録",
  );
}

/**
 * ファイルを Storage へアップロードし、`materials` へ行を作る。
 * パス規則: `{user_id}/{material_id}/{file_name}`（`0002_rls.sql` の
 * `materials_storage_own` ポリシー前提）。行 insert に失敗した場合は
 * アップロード済みファイルを削除し、孤児を残さない。
 */
export async function uploadMaterial(
  supabase: DB,
  shelfId: string,
  file: File,
): Promise<MaterialRow> {
  if (file.size === 0) throw new Error("ファイルが空です。");
  if (file.size > MAX_MATERIAL_BYTES) {
    throw new Error(`ファイルが大きすぎます（上限 ${Math.floor(MAX_MATERIAL_BYTES / 1024 / 1024)}MB）。`);
  }
  const mimeType = resolveMimeType(file);
  if (!ALLOWED_MIME.includes(mimeType)) {
    throw new Error(`ファイル形式（${mimeType || "不明"}）は未対応です。対応: PDF / テキスト / PNG / JPEG / WebP。`);
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");

  const id = crypto.randomUUID();
  const storagePath = `${auth.user.id}/${id}/${sanitizeForStorageKey(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("materials")
    .upload(storagePath, file, { contentType: mimeType, upsert: false });
  if (uploadError) {
    console.error("[data] 資料のアップロード", uploadError);
    throw new Error("資料のアップロードに失敗しました。");
  }

  try {
    return await createMaterial(supabase, {
      id,
      shelf_id: shelfId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: mimeType,
      size_bytes: file.size,
    });
  } catch (err) {
    await supabase.storage.from("materials").remove([storagePath]);
    throw err;
  }
}

export async function deleteMaterial(supabase: DB, id: string): Promise<void> {
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) {
    console.error("[data] 資料の削除", error);
    throw new Error("資料の削除に失敗しました。");
  }
}
