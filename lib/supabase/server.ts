import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

/**
 * Server Component / Route Handler 用の Supabase クライアント。
 * anon キー＋ RLS を前提とする（`google_credentials` など全拒否テーブルは
 * `lib/supabase/admin.ts` を使うこと）。
 *
 * Next.js 16 では `cookies()` が非同期のため、この関数自体も async。
 * Server Component から呼ぶ場合、`cookies().set` は Server Action /
 * Route Handler からしか呼べない（Server Component は読み取り専用）。
 * そちらは `proxy.ts` のセッション更新に任せ、ここでは失敗を無視する。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component から呼ばれた場合は書き込めない。
            // セッションの更新は proxy.ts が行うため無視してよい。
          }
        },
      },
    },
  );
}
