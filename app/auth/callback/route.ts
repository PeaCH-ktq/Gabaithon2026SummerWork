import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Google ログインの OAuth コールバック。
 * `code` をセッションに交換し、`provider_refresh_token` があれば
 * `google_credentials` へ保存する（カレンダー書き込み用）。
 *
 * `prompt=consent` を常に指定しているため、`provider_refresh_token` は
 * 初回ログインに限らず毎回返ってくる。「初回のみ保存」という特別扱いは不要で、
 * 「あれば毎回 upsert」でよい。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const authError = searchParams.get("error");
  const next = safeNextPath(searchParams.get("next"));

  if (authError) {
    return redirectWithParam(request, next, "auth_error", "denied");
  }

  if (!code) {
    return redirectWithParam(request, next, "auth_error", "missing_code");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    console.error("[auth/callback] exchangeCodeForSession failed", error);
    return redirectWithParam(request, next, "auth_error", "exchange_failed");
  }

  const refreshToken = data.session.provider_refresh_token;
  if (refreshToken) {
    const admin = getSupabaseAdminClient();
    const { error: upsertError } = await admin
      .from("google_credentials")
      .upsert(
        { user_id: data.user.id, refresh_token: refreshToken },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error(
        "[auth/callback] google_credentials upsert failed",
        data.user.id,
        upsertError,
      );
      return redirectWithParam(request, next, "calendar_link_failed", "1");
    }
  } else {
    console.warn(
      "[auth/callback] provider_refresh_token missing for user",
      data.user.id,
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}

/** オープンリダイレクト対策: `/` 始まり かつ `//` ではない相対パスのみ許可する。 */
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function redirectWithParam(
  request: NextRequest,
  next: string,
  key: string,
  value: string,
) {
  const url = new URL(next, request.url);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}
