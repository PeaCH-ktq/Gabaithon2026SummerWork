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

  // トークンの有効期限が近ければ更新する。戻り値は使わないが、呼び出し自体が
  // Cookie の書き換え（上記 setAll）を引き起こす。
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
