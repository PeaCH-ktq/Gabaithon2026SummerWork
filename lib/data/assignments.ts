import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Shelf } from "@/app/types";
import { unwrap } from "./utils";

type DB = SupabaseClient<Database>;
type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
type AssignmentInsert = Database["public"]["Tables"]["assignments"]["Insert"];
type AssignmentReportRow =
  Database["public"]["Tables"]["assignment_reports"]["Row"];

/**
 * 自分に見える課題の一覧（RLS: 所属グループへ共有された課題、または自分の棚の課題）。
 * 締切が近い順。
 */
export async function listAssignments(supabase: DB): Promise<AssignmentRow[]> {
  return unwrap(
    await supabase.from("assignments").select("*").order("due_at", { ascending: true }),
    "課題の取得",
  );
}

export async function createAssignment(
  supabase: DB,
  input: Omit<AssignmentInsert, "created_by">,
): Promise<AssignmentRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  return unwrap(
    await supabase
      .from("assignments")
      .insert({ ...input, created_by: auth.user.id })
      .select()
      .single(),
    "課題の作成",
  );
}

/** 自分の課題結果報告一覧（`assignment_reports_write_own` により自分の行は常に見える）。 */
export async function listMyAssignmentReports(
  supabase: DB,
): Promise<AssignmentReportRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  return unwrap(
    await supabase
      .from("assignment_reports")
      .select("*")
      .eq("user_id", auth.user.id),
    "課題結果の取得",
  );
}

/** 課題の結果を投稿・編集する（1課題につき自分の行は1件のみ、upsert）。 */
export async function upsertAssignmentReport(
  supabase: DB,
  input: { assignment_id: string; minutes_spent: number; comment: string },
): Promise<AssignmentReportRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  return unwrap(
    await supabase
      .from("assignment_reports")
      .upsert(
        { ...input, user_id: auth.user.id },
        { onConflict: "assignment_id,user_id" },
      )
      .select()
      .single(),
    "課題結果の投稿",
  );
}

/** 課題を未完了に戻す（＝自分の結果報告を削除）。 */
export async function deleteAssignmentReport(
  supabase: DB,
  assignmentId: string,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  const { error } = await supabase
    .from("assignment_reports")
    .delete()
    .eq("assignment_id", assignmentId)
    .eq("user_id", auth.user.id);
  if (error) {
    console.error("[data] 課題結果の削除", error);
    throw new Error("未完了に戻す操作に失敗しました。");
  }
}

/**
 * 課題を作成する棚の共有先グループを自動決定する。
 * 表示中（visible）の共有先がちょうど1件ならそのグループに共有し、
 * 0件・複数件の場合は本人のみ閲覧できる個人課題（null）にする。
 */
export function pickAssignmentGroupId(shelf: Shelf): string | null {
  const visible = shelf.shares.filter((s) => s.visible);
  return visible.length === 1 ? visible[0].group_id : null;
}
