import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

/**
 * ブラウザ（Client Component）用の Supabase クライアント。
 * `NEXT_PUBLIC_*` のみを使うため、そのままクライアントバンドルに含めてよい。
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
