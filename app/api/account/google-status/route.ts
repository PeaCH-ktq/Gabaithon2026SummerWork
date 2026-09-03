import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// google_credentials は RLS 全拒否のため service-role が要る。
export const runtime = "nodejs";

/**
 * 自分の Google カレンダー連携状態を返す。
 * `google_credentials` は RLS で全拒否されているため admin クライアント経由で読む
 * （自分の user_id の行しか見ないため情報漏洩は無い）。
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("google_credentials")
    .select("updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[api/account/google-status]", error);
    return Response.json({ error: "連携状態の取得に失敗しました。" }, { status: 500 });
  }

  return Response.json({ connected: !!data, updatedAt: data?.updated_at ?? null });
}
