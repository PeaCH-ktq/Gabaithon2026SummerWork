import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import {
  GoogleAuthError,
  createCalendarEvent,
  deleteCalendarEvent,
  getAccessToken,
} from "@/lib/google/calendar";

type StudySession = Database["public"]["Tables"]["study_sessions"]["Row"];

export interface SyncResult {
  created: { user_id: string; event_id: string }[];
  skipped: { user_id: string; reason: "no_credentials" | "already_synced" }[];
  failed: { user_id: string; error: string; reauth_required?: boolean }[];
}

export interface UnsyncResult {
  deleted: string[];
  failed: { user_id: string; error: string; reauth_required?: boolean }[];
}

/** 対象ユーザーの refresh token を user_id → token で引く。 */
async function loadRefreshTokens(
  userIds: string[],
): Promise<Map<string, string>> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("google_credentials")
    .select("user_id, refresh_token")
    .in("user_id", userIds);
  if (error) throw new Error(`google_credentials の取得に失敗しました: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.user_id, r.refresh_token]));
}

/**
 * study_session をグループメンバー全員（`memberIds`）の Google カレンダーへ書き込む。
 * refresh token が無いメンバー・既に同期済みのメンバーはスキップする。
 */
export async function syncStudySessionToCalendars(
  session: StudySession,
  memberIds: string[],
): Promise<SyncResult> {
  const admin = getSupabaseAdminClient();
  const result: SyncResult = { created: [], skipped: [], failed: [] };

  const tokens = await loadRefreshTokens(memberIds);

  const { data: existing, error: existingErr } = await admin
    .from("calendar_events")
    .select("user_id")
    .eq("study_session_id", session.id);
  if (existingErr) {
    throw new Error(`calendar_events の取得に失敗しました: ${existingErr.message}`);
  }
  const alreadySynced = new Set((existing ?? []).map((r) => r.user_id));

  for (const userId of memberIds) {
    if (alreadySynced.has(userId)) {
      result.skipped.push({ user_id: userId, reason: "already_synced" });
      continue;
    }
    const refreshToken = tokens.get(userId);
    if (!refreshToken) {
      result.skipped.push({ user_id: userId, reason: "no_credentials" });
      continue;
    }

    try {
      const accessToken = await getAccessToken(refreshToken);
      const eventId = await createCalendarEvent(accessToken, {
        summary: session.title,
        location: session.location,
        description: "TanE のグループ勉強予定",
        startISO: session.starts_at,
        endISO: session.ends_at,
      });

      const { error: insertErr } = await admin
        .from("calendar_events")
        .insert({
          study_session_id: session.id,
          user_id: userId,
          google_event_id: eventId,
        });
      if (insertErr) {
        // イベントは作れたが記録に失敗。Google 側を巻き戻しておく。
        await deleteCalendarEvent(
          await getAccessToken(refreshToken),
          eventId,
        ).catch(() => {});
        throw new Error(insertErr.message);
      }

      result.created.push({ user_id: userId, event_id: eventId });
    } catch (e) {
      if (e instanceof GoogleAuthError) {
        result.failed.push({
          user_id: userId,
          error: e.message,
          reauth_required: true,
        });
      } else {
        result.failed.push({
          user_id: userId,
          error: e instanceof Error ? e.message : "不明なエラー",
        });
      }
    }
  }

  return result;
}

/**
 * study_session に紐づく Google イベントを削除し、`calendar_events` 行も消す。
 * `study_sessions` 行自体は消さない。
 *
 * `userId` を渡すとそのユーザーぶんだけを取り消す（グループ脱退時に使う）。
 * 省略すると全メンバーぶんを取り消す。
 */
export async function unsyncStudySession(
  studySessionId: string,
  userId?: string,
): Promise<UnsyncResult> {
  const admin = getSupabaseAdminClient();
  const result: UnsyncResult = { deleted: [], failed: [] };

  let query = admin
    .from("calendar_events")
    .select("user_id, google_event_id")
    .eq("study_session_id", studySessionId);
  if (userId) query = query.eq("user_id", userId);
  const { data: rows, error } = await query;
  if (error) {
    throw new Error(`calendar_events の取得に失敗しました: ${error.message}`);
  }
  if (!rows || rows.length === 0) return result;

  const tokens = await loadRefreshTokens(rows.map((r) => r.user_id));

  for (const row of rows) {
    const refreshToken = tokens.get(row.user_id);
    try {
      if (refreshToken) {
        const accessToken = await getAccessToken(refreshToken);
        await deleteCalendarEvent(accessToken, row.google_event_id);
      }
      // token が無い場合、Google 側は消せないが追跡行は無意味なので削除する。
      const { error: delErr } = await admin
        .from("calendar_events")
        .delete()
        .eq("study_session_id", studySessionId)
        .eq("user_id", row.user_id);
      if (delErr) throw new Error(delErr.message);

      if (refreshToken) {
        result.deleted.push(row.user_id);
      } else {
        result.failed.push({
          user_id: row.user_id,
          error: "Google の再連携が必要なため、カレンダー側のイベントは残っています。",
          reauth_required: true,
        });
      }
    } catch (e) {
      if (e instanceof GoogleAuthError) {
        // token が失効。追跡行だけ消しておく。
        await admin
          .from("calendar_events")
          .delete()
          .eq("study_session_id", studySessionId)
          .eq("user_id", row.user_id)
          .then(() => {});
        result.failed.push({
          user_id: row.user_id,
          error: e.message,
          reauth_required: true,
        });
      } else {
        result.failed.push({
          user_id: row.user_id,
          error: e instanceof Error ? e.message : "不明なエラー",
        });
      }
    }
  }

  return result;
}
