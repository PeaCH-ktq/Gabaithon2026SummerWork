/**
 * `/api/calendar/events` Route Handler を叩く薄いクライアント。
 * `lib/data/*` は supabase 直叩き専用のためここは分ける。
 */
import type { SyncResult, UnsyncResult } from "@/lib/google/calendarSync";

export type { SyncResult, UnsyncResult };

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** 勉強会を参加者全員の Google カレンダーへ書き込む。 */
export async function syncSessionToCalendar(studySessionId: string): Promise<SyncResult> {
  const res = await fetch("/api/calendar/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ study_session_id: studySessionId }),
  });
  if (!res.ok) throw new Error(await readError(res, "カレンダー連携に失敗しました。"));
  return res.json();
}

/** 勉強会に紐づく Google カレンダーの予定を全員ぶん取り消す。 */
export async function unsyncSessionFromCalendar(studySessionId: string): Promise<UnsyncResult> {
  const res = await fetch(`/api/calendar/events/${studySessionId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res, "カレンダーの取り消しに失敗しました。"));
  return res.json();
}

/** SyncResult をトースト用の1行にまとめる。 */
export function summarizeSync(result: SyncResult): string {
  const parts: string[] = [];
  if (result.created.length > 0) {
    parts.push(`${result.created.length}人のカレンダーに追加しました`);
  } else if (result.skipped.some((s) => s.reason === "already_synced")) {
    parts.push("すでに全員のカレンダーに追加済みです");
  } else {
    parts.push("カレンダーに追加できるメンバーがいませんでした");
  }
  const noCredentials = result.skipped.filter((s) => s.reason === "no_credentials").length;
  if (noCredentials > 0) parts.push(`未連携 ${noCredentials}人`);
  if (result.failed.length > 0) parts.push(`失敗 ${result.failed.length}人`);
  return parts.length > 1 ? `${parts[0]}（${parts.slice(1).join("・")}）` : parts[0];
}

/** 自分が Google の再連携を必要としているか。 */
export function needsReauth(result: SyncResult | UnsyncResult, userId: string | null): boolean {
  if (!userId) return false;
  return result.failed.some((f) => f.user_id === userId && f.reauth_required);
}
