import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { unsyncStudySession, type UnsyncResult } from "@/lib/google/calendarSync";

export const runtime = "nodejs";
export const maxDuration = 60;

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * グループから脱退する。`[id]` は group_id。
 *
 * `group_members` を直接 delete するだけだと、Google カレンダーへ書き込み済みの
 * 勉強会イベントと `calendar_events` 行が残る。`calendar_events` は RLS 全拒否で
 * クライアントからは掃除できないため、脱退そのものをここに集約する。
 *
 * - 最後の1人 … グループが `delete_empty_group` トリガーで消え、study_sessions も
 *   cascade で消える。**終了済みを含む全期間**の予定を全員ぶん取り消してから抜ける。
 * - それ以外 … 自分ぶんの予定だけを取り消す。他のメンバーの予定はそのまま。
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: groupId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("ログインが必要です。", 401);

  // RLS（group_members_select = is_group_member）を通すことでメンバーであることを担保する。
  // 自分の行が返らなければメンバーではない。
  const { data: members, error: membersErr } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  if (membersErr) {
    console.error("[groups/leave] メンバーの取得", membersErr);
    return bad("グループの情報を取得できませんでした。", 500);
  }
  if (!members?.some((m) => m.user_id === user.id)) {
    return bad("このグループのメンバーではありません。", 404);
  }
  const isLastMember = members.length === 1;

  // 予定の一覧はユーザースコープで引く（study_sessions_select = is_group_member）。
  // listUpcomingSessions と違い ends_at で絞らない。終了済みの予定も
  // Google カレンダー上には残っているため。
  const { data: sessions, error: sessionsErr } = await supabase
    .from("study_sessions")
    .select("id")
    .eq("group_id", groupId);
  if (sessionsErr) {
    console.error("[groups/leave] 勉強会の取得", sessionsErr);
    return bad("勉強会の情報を取得できませんでした。", 500);
  }

  const result: UnsyncResult = { deleted: [], failed: [] };
  for (const session of sessions ?? []) {
    try {
      const one = await unsyncStudySession(
        session.id,
        isLastMember ? undefined : user.id,
      );
      result.deleted.push(...one.deleted);
      result.failed.push(...one.failed);
    } catch (e) {
      console.error("[groups/leave] カレンダー取り消し", e);
      result.failed.push({
        user_id: user.id,
        error: e instanceof Error ? e.message : "不明なエラー",
      });
    }
  }

  // 脱退本体はユーザースコープで実行する。group_members_delete_self ポリシーが効き、
  // on_group_member_left トリガーが pg_trigger_depth() = 1 で正しく発火する
  // （admin クライアントでも発火はするが、権限判定をポリシーに委ねたい）。
  const { error: leaveErr } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);
  if (leaveErr) {
    console.error("[groups/leave] 脱退", leaveErr);
    return bad("グループの脱退に失敗しました。", 500);
  }

  // 脱退後は自分の calendar_events を RLS 経由で消せない（そもそも全拒否）ので、
  // 取りこぼしを service-role で掃除しておく。Google 側は上のループが処理済み。
  if (!isLastMember && (sessions?.length ?? 0) > 0) {
    const admin = getSupabaseAdminClient();
    const { error: cleanupErr } = await admin
      .from("calendar_events")
      .delete()
      .eq("user_id", user.id)
      .in("study_session_id", (sessions ?? []).map((s) => s.id));
    if (cleanupErr) {
      console.error("[groups/leave] calendar_events の掃除", cleanupErr);
    }
  }

  return Response.json({ left: true, group_deleted: isLastMember, ...result });
}
