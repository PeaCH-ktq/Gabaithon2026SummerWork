/**
 * `/api/account/google-status` Route Handler を叩く薄いクライアント。
 * `google_credentials` は RLS 全拒否のため `lib/data/*` からは読めない。
 */
export type GoogleStatus = { connected: boolean; updatedAt: string | null };

export async function fetchGoogleStatus(): Promise<GoogleStatus> {
  const res = await fetch("/api/account/google-status");
  if (!res.ok) throw new Error("連携状態の取得に失敗しました。");
  return res.json();
}
