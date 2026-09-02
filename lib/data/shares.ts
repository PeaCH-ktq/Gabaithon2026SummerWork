import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { unwrap } from "./utils";

type DB = SupabaseClient<Database>;

/** 棚をグループへ共有する（対象棚の所有者のみ）。 */
export async function shareShelf(
  supabase: DB,
  shelfId: string,
  groupId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shelf_shares")
    .upsert(
      { shelf_id: shelfId, group_id: groupId, visible: true },
      { onConflict: "shelf_id,group_id" },
    );
  if (error) {
    console.error("[data] 棚の共有", error);
    throw new Error("棚の共有に失敗しました。");
  }
}

export async function unshareShelf(
  supabase: DB,
  shelfId: string,
  groupId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shelf_shares")
    .delete()
    .eq("shelf_id", shelfId)
    .eq("group_id", groupId);
  if (error) {
    console.error("[data] 棚の共有解除", error);
    throw new Error("棚の共有解除に失敗しました。");
  }
}

/** 共有済みの棚の表示/非表示を切り替える。 */
export async function setShelfVisible(
  supabase: DB,
  shelfId: string,
  groupId: string,
  visible: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("shelf_shares")
    .update({ visible })
    .eq("shelf_id", shelfId)
    .eq("group_id", groupId);
  if (error) {
    console.error("[data] 表示設定の更新", error);
    throw new Error("表示設定の更新に失敗しました。");
  }
}

/** 問題集をグループへ共有する（対象問題集の所有者のみ）。 */
export async function shareQuestionSet(
  supabase: DB,
  questionSetId: string,
  groupId: string,
): Promise<void> {
  const { error } = await supabase
    .from("question_set_shares")
    .upsert(
      { question_set_id: questionSetId, group_id: groupId },
      { onConflict: "question_set_id,group_id" },
    );
  if (error) {
    console.error("[data] 問題集の共有", error);
    throw new Error("問題集の共有に失敗しました。");
  }
}

export async function unshareQuestionSet(
  supabase: DB,
  questionSetId: string,
  groupId: string,
): Promise<void> {
  const { error } = await supabase
    .from("question_set_shares")
    .delete()
    .eq("question_set_id", questionSetId)
    .eq("group_id", groupId);
  if (error) {
    console.error("[data] 問題集の共有解除", error);
    throw new Error("問題集の共有解除に失敗しました。");
  }
}

/** 自分に見える共有一覧（棚）。 */
export async function listShelfShares(supabase: DB) {
  return unwrap(
    await supabase.from("shelf_shares").select("*"),
    "共有情報の取得",
  );
}
