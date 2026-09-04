/**
 * `/api/groups/*` Route Handler を叩く薄いクライアント。
 * `lib/data/*` は supabase 直叩き専用のためここは分ける（`lib/api/calendar.ts` と同じ形）。
 */
import type { UnsyncResult } from "@/lib/google/calendarSync";

export type LeaveGroupResult = UnsyncResult & {
  left: boolean;
  /** 最後の1人だったためグループごと削除されたか。 */
  group_deleted: boolean;
};

/**
 * グループから脱退する。Google カレンダーへ書き込み済みの予定の取り消しも
 * サーバー側でまとめて行う（`calendar_events` は RLS 全拒否でクライアントから触れない）。
 */
export async function leaveGroupViaApi(groupId: string): Promise<LeaveGroupResult> {
  const res = await fetch(`/api/groups/${groupId}/leave`, { method: "POST" });
  if (!res.ok) {
    let message = "グループの脱退に失敗しました。";
    try {
      const body = (await res.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // JSON でないレスポンスは既定のメッセージのまま返す。
    }
    throw new Error(message);
  }
  return res.json();
}
