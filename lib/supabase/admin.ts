import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * service-role キーで RLS を回避するクライアント。
 *
 * `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用の環境変数（`NEXT_PUBLIC_` を付けていない
 * ためクライアントバンドルには含まれない）。このモジュールを import してよいのは
 * Route Handler / Server Action など、サーバーでのみ実行されるコードに限る。
 *
 * 用途は `google_credentials`（RLS で全拒否）の読み書きなど、
 * ユーザーのセッションでは到達できない操作のみ。通常のデータアクセスには
 * `lib/supabase/server.ts` の RLS 前提クライアントを使うこと。
 */
let client: ReturnType<typeof createSupabaseClient<Database>> | undefined;

export function getSupabaseAdminClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません。`.env.local` に設定してください。",
    );
  }

  client = createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
