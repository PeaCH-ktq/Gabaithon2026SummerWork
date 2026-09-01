import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { unwrap } from "./utils";

type DB = SupabaseClient<Database>;
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type MaterialInsert = Database["public"]["Tables"]["materials"]["Insert"];

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

export async function deleteMaterial(supabase: DB, id: string): Promise<void> {
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) {
    console.error("[data] 資料の削除", error);
    throw new Error("資料の削除に失敗しました。");
  }
}
