import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Shelf } from "@/app/types";
import { unwrap } from "./utils";

type DB = SupabaseClient<Database>;
type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
type AssignmentInsert = Database["public"]["Tables"]["assignments"]["Insert"];
type AssignmentReportRow =
  Database["public"]["Tables"]["assignment_reports"]["Row"];

/** 課題の行に共有先グループ ID を添えたもの。 */
export type Assignment = AssignmentRow & { groupIds: string[] };

/**
 * 自分に見える課題の一覧（RLS: 所属グループへ可視共有された課題、または自分の棚の課題）。
 * 締切が近い順。
 *
 * 共有先は `assignment_shares` から引いて JS で畳む。PostgREST の埋め込みを
 * 使わないのは `lib/supabase/types.ts` の `Relationships: []` が手書きのままだと
 * 型推論が壊れるため（`lib/data/shelves.ts:listShelves` と同じ理由）。
 */
export async function listAssignments(supabase: DB): Promise<Assignment[]> {
  const rows = unwrap(
    await supabase.from("assignments").select("*").order("due_at", { ascending: true }),
    "課題の取得",
  );
  if (rows.length === 0) return [];

  const shares = unwrap(
    await supabase
      .from("assignment_shares")
      .select("assignment_id, group_id")
      .in("assignment_id", rows.map((r) => r.id)),
    "課題の共有先の取得",
  );
  const groupIdsByAssignment = new Map<string, string[]>();
  for (const s of shares) {
    const list = groupIdsByAssignment.get(s.assignment_id) ?? [];
    list.push(s.group_id);
    groupIdsByAssignment.set(s.assignment_id, list);
  }

  return rows.map((row) => ({
    ...row,
    groupIds: groupIdsByAssignment.get(row.id) ?? [],
  }));
}

/**
 * 課題を作成し、`groupIds` のグループへ共有する。
 * `groupIds` が空なら本人（と棚の所有者）だけが見られる個人課題になる。
 */
export async function createAssignment(
  supabase: DB,
  input: Omit<AssignmentInsert, "created_by">,
  groupIds: string[] = [],
): Promise<Assignment> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  // `unwrap` の型引数は戻り値の文脈から決まる。const に受けるとその文脈が
  // 無くなって never に落ちるため、明示的に注釈する。
  const row: AssignmentRow = unwrap(
    await supabase
      .from("assignments")
      .insert({ ...input, created_by: auth.user.id })
      .select()
      .single(),
    "課題の作成",
  );

  if (groupIds.length === 0) return { ...row, groupIds: [] };

  const { error } = await supabase
    .from("assignment_shares")
    .insert(groupIds.map((groupId) => ({ assignment_id: row.id, group_id: groupId })));
  if (error) {
    // 共有に失敗した課題が個人課題として残ると分かりにくいので巻き戻す。
    await supabase.from("assignments").delete().eq("id", row.id);
    console.error("[data] 課題の共有", error);
    throw new Error("課題の共有に失敗しました。");
  }
  return { ...row, groupIds };
}

/** 課題の共有先を差分更新する（`app/page.tsx:saveShares` と同じ形）。 */
export async function updateAssignmentShares(
  supabase: DB,
  assignmentId: string,
  groupIds: string[],
  currentGroupIds: string[],
): Promise<void> {
  const next = new Set(groupIds);
  const toAdd = groupIds.filter((id) => !currentGroupIds.includes(id));
  const toRemove = currentGroupIds.filter((id) => !next.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("assignment_shares")
      .insert(toAdd.map((groupId) => ({ assignment_id: assignmentId, group_id: groupId })));
    if (error) {
      console.error("[data] 課題の共有", error);
      throw new Error("課題の共有に失敗しました。");
    }
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("assignment_shares")
      .delete()
      .eq("assignment_id", assignmentId)
      .in("group_id", toRemove);
    if (error) {
      console.error("[data] 課題の共有解除", error);
      throw new Error("課題の共有解除に失敗しました。");
    }
  }
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

/** 課題を削除する（RLS: `assignments_delete_own` により作成者のみ）。 */
export async function deleteAssignment(
  supabase: DB,
  assignmentId: string,
): Promise<void> {
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) {
    console.error("[data] 課題の削除", error);
    throw new Error("課題の削除に失敗しました。");
  }
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

/** グループの「みんなの学習記録」1件分（メンバーの課題結果報告）。 */
export type GroupStudyLogEntry = {
  reportId: string;
  assignmentTitle: string;
  minutesSpent: number;
  comment: string | null;
  createdAt: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

/**
 * グループに共有された課題へのメンバーの結果報告一覧（新しい順、直近30件）。
 * 埋め込み JOIN は使わずクエリ + JS 結合。
 *
 * **このグループのメンバーが書いた report だけ**に絞っている点に注意。
 * 課題を複数グループへ同時共有できるようになったため、`assignment_reports_select`
 * （= `is_assignment_visible`）だけに任せると、グループ A のメンバーの記録が
 * グループ B の画面にも出てしまう。同じ課題を共有している以上 RLS としては
 * 筋が通っているが、利用者にとっては驚きになるので表示側で閉じる。
 * 方針を反転したければこの絞り込みを外すだけでよい。
 */
export async function listGroupStudyLog(
  supabase: DB,
  groupId: string,
): Promise<GroupStudyLogEntry[]> {
  const shares = unwrap(
    await supabase
      .from("assignment_shares")
      .select("assignment_id")
      .eq("group_id", groupId),
    "学習記録の取得",
  );
  if (shares.length === 0) return [];

  const assignments = unwrap(
    await supabase
      .from("assignments")
      .select("id, title")
      .in("id", shares.map((s) => s.assignment_id)),
    "学習記録の取得",
  );
  if (assignments.length === 0) return [];
  const titleById = new Map(assignments.map((a) => [a.id, a.title]));

  const members = unwrap(
    await supabase.from("group_members").select("user_id").eq("group_id", groupId),
    "学習記録の取得",
  );
  const memberIds = members.map((m) => m.user_id);
  if (memberIds.length === 0) return [];

  const reports = unwrap(
    await supabase
      .from("assignment_reports")
      .select("*")
      .in("assignment_id", assignments.map((a) => a.id))
      .in("user_id", memberIds)
      .order("created_at", { ascending: false })
      .limit(30),
    "学習記録の取得",
  );
  if (reports.length === 0) return [];

  const profiles = unwrap(
    await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", [...new Set(reports.map((r) => r.user_id))]),
    "プロフィールの取得",
  );
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return reports.map((r) => ({
    reportId: r.id,
    assignmentTitle: titleById.get(r.assignment_id) ?? "（削除された課題）",
    minutesSpent: r.minutes_spent,
    comment: r.comment,
    createdAt: r.created_at,
    userId: r.user_id,
    displayName: profileById.get(r.user_id)?.display_name ?? "（不明なユーザー）",
    avatarUrl: profileById.get(r.user_id)?.avatar_url ?? null,
  }));
}

/**
 * 課題の共有先として選べるグループ（＝棚が「表示中」で共有されているグループ）。
 * `assignment_shares` の insert ポリシー（`assignment_shelf_shared_to`）が
 * 同じ条件を要求するので、UI の選択肢はこれと一致させる。
 */
export function shareableGroupIds(shelf: Shelf): string[] {
  return shelf.shares.filter((s) => s.visible).map((s) => s.group_id);
}
