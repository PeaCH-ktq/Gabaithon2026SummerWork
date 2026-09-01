import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { unwrap } from "./utils";

type DB = SupabaseClient<Database>;
type StudySessionRow = Database["public"]["Tables"]["study_sessions"]["Row"];
type StudySessionInsert = Database["public"]["Tables"]["study_sessions"]["Insert"];

/**
 * 直近の勉強会（終了前のもの）。RLS: 所属グループのものだけ。
 * `groupId` を渡せばそのグループに絞る。
 */
export async function listUpcomingSessions(
  supabase: DB,
  groupId?: string,
): Promise<StudySessionRow[]> {
  let query = supabase
    .from("study_sessions")
    .select("*")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (groupId) query = query.eq("group_id", groupId);
  return unwrap(await query, "勉強会の取得");
}

export async function createStudySession(
  supabase: DB,
  input: Omit<StudySessionInsert, "created_by">,
): Promise<StudySessionRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  return unwrap(
    await supabase
      .from("study_sessions")
      .insert({ ...input, created_by: auth.user.id })
      .select()
      .single(),
    "勉強会の作成",
  );
}

export async function deleteStudySession(supabase: DB, id: string): Promise<void> {
  const { error } = await supabase.from("study_sessions").delete().eq("id", id);
  if (error) {
    console.error("[data] 勉強会の削除", error);
    throw new Error("勉強会の削除に失敗しました。");
  }
}
