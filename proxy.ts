import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase セッション（Cookie）を各リクエストで更新する。
 *
 * Next.js 16 では `middleware.ts` が `proxy.ts` に改名され、エクスポート名も
 * `middleware` から `proxy` に変わっている（`node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/proxy.md` 参照）。API 自体
 * （NextRequest/NextResponse）は変わっていない。
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // トークンの有効期限が近ければ更新する。ついでにログイン状態も判定する。
  // 呼び出し自体が Cookie の書き換え（上記 setAll）を引き起こす。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // 認証なしでアクセスしてよいパス。OAuth コールバック・ログイン・ログアウト・API は除外。
  const isPublic =
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api");

  // 未ログインで保護ページを開いたら /login へ送る（元のパスを next で保持）。
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    // コールバックがエラーを付けて戻してきた場合はログイン画面まで引き継ぐ。
    const authError = request.nextUrl.searchParams.get("auth_error");
    if (authError) url.searchParams.set("auth_error", authError);
    return NextResponse.redirect(url);
  }

  // ログイン済みで /login を開いたらアプリ本体へ戻す。
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
