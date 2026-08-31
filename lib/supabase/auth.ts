import { createClient } from "@/lib/supabase/client";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

/**
 * Google ログインを開始する。ログインボタンの onClick などから呼ぶ（Client Component 専用）。
 * scope / access_type=offline / prompt=consent は変更しないこと
 * （google_credentials への refresh_token 保存が前提のため）。
 */
export async function signInWithGoogle(nextPath = "/") {
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: CALENDAR_SCOPE,
      queryParams: { access_type: "offline", prompt: "consent" },
      redirectTo,
    },
  });

  if (error) throw error;
}

/**
 * ログアウトする（Client Component 専用）。
 * Cookie 上のセッションが破棄されるため、呼び出し後は保護ページから
 * `proxy.ts` により `/login` へリダイレクトされる。
 */
export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
