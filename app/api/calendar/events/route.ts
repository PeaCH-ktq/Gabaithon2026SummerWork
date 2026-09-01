import { createClient } from "@/lib/supabase/server";
import { syncStudySessionToCalendars } from "@/lib/google/calendarSync";

// Google API 呼び出し（複数メンバー分）で時間がかかるため Node ランタイム＋延長。
export const runtime = "nodejs";
export const maxDuration = 60;

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * グループ勉強の予定を、そのグループのメンバー全員の Google カレンダーへ書き込む。
 * ペイロード: `{ study_session_id: string }`
 *
 * 認可はグループメンバーであること（`study_sessions` を session 付きクライアントで
 * 読めること＝ `is_group_member` を RLS が保証）のみ。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("ログインが必要です。", 401);

  let body: { study_session_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad("JSON ボディを送信してください。");
  }
  const studySessionId = body.study_session_id;
  if (typeof studySessionId !== "string" || !studySessionId) {
    return bad("study_session_id は必須です。");
  }

  // RLS 通過で「メンバーである」ことを担保する。
  const { data: session, error: sessionErr } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("id", studySessionId)
    .single();
  if (sessionErr || !session) {
    return bad("予定が見つからないか、アクセス権がありません。", 404);
  }

  const { data: members, error: membersErr } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", session.group_id);
  if (membersErr || !members) {
    return bad("グループメンバーの取得に失敗しました。", 502);
  }

  try {
    const result = await syncStudySessionToCalendars(
      session,
      members.map((m) => m.user_id),
    );
    return Response.json(result);
  } catch (e) {
    console.error("[calendar/events POST]", e);
    const message = e instanceof Error ? e.message : "カレンダー書き込みに失敗しました。";
    return bad(message, 502);
  }
}
