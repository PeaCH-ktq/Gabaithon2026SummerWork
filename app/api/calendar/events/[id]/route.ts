import { createClient } from "@/lib/supabase/server";
import { unsyncStudySession } from "@/lib/google/calendarSync";

export const runtime = "nodejs";
export const maxDuration = 60;

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * 予定の Google カレンダー反映を取り消す。
 * `[id]` は **study_session_id**（全員書き込みと対称にするため、Google イベント ID ではない）。
 *
 * その予定に紐づく `calendar_events` 全行をループして各メンバーの Google イベントを削除し、
 * 行も消す。`study_sessions` 行そのものは消さない（予定レコードの削除は FE の責務）。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: studySessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("ログインが必要です。", 401);

  // RLS 通過で「メンバーである」ことを担保する。
  const { data: session, error: sessionErr } = await supabase
    .from("study_sessions")
    .select("id, group_id")
    .eq("id", studySessionId)
    .single();
  if (sessionErr || !session) {
    return bad("予定が見つからないか、アクセス権がありません。", 404);
  }

  try {
    const result = await unsyncStudySession(studySessionId);
    return Response.json(result);
  } catch (e) {
    console.error("[calendar/events DELETE]", e);
    const message = e instanceof Error ? e.message : "カレンダー取り消しに失敗しました。";
    return bad(message, 502);
  }
}
