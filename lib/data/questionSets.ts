import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { QuestionSet } from "@/lib/gemini/schema";
import { unwrap } from "./utils";

type DB = SupabaseClient<Database>;
type QuestionSetRow = Database["public"]["Tables"]["question_sets"]["Row"];

/** 指定した棚の問題集一覧（本人＋共有先グループメンバー。RLS が絞る）。 */
export async function listQuestionSetsByShelf(
  supabase: DB,
  shelfId: string,
): Promise<QuestionSetRow[]> {
  return unwrap(
    await supabase
      .from("question_sets")
      .select("*")
      .eq("shelf_id", shelfId)
      .order("created_at", { ascending: false }),
    "問題集の取得",
  );
}

/** 1件の問題集。`content` は `QuestionSet` として返す。 */
export async function getQuestionSet(
  supabase: DB,
  id: string,
): Promise<QuestionSetRow & { content: QuestionSet }> {
  const row: QuestionSetRow = unwrap(
    await supabase.from("question_sets").select("*").eq("id", id).single(),
    "問題集の取得",
  );
  return { ...row, content: row.content as QuestionSet };
}
