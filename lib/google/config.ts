/**
 * Google OAuth のクライアント資格情報（サーバー専用）。
 *
 * `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` は Google ログイン用に
 * Supabase ダッシュボードにも設定するが、カレンダー書き込みでは
 * アプリのサーバー側から直接 `oauth2.googleapis.com/token` を叩いて
 * refresh token を access token に交換するため、ここでも読む。
 * `NEXT_PUBLIC_` を付けていないのでクライアントバンドルには含まれない。
 */
export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が設定されていません。`.env.local` に設定してください。",
    );
  }
  return { clientId, clientSecret };
}
