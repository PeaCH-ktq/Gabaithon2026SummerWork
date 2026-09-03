import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AccountProfile, ProfileRow } from "@/app/types";
import { unwrap } from "./utils";

type DB = SupabaseClient<Database>;

/** 自分のプロフィール（`profiles` ＋ `auth.users.email`）。 */
export async function getMyProfile(supabase: DB): Promise<AccountProfile> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  const user = auth.user;

  const { data: row, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[data] プロフィールの取得", error);
    throw new Error("プロフィールの取得に失敗しました。");
  }

  const metadata = user.user_metadata as Record<string, unknown>;
  const fallbackName = (metadata.full_name ?? metadata.name ?? user.email ?? "unknown") as string;
  const fallbackAvatar = (metadata.avatar_url ?? metadata.picture ?? null) as string | null;

  return {
    id: user.id,
    displayName: row?.display_name ?? fallbackName,
    avatarUrl: row?.avatar_url ?? fallbackAvatar,
    email: user.email ?? "",
  };
}

/** 表示名を更新する（本人のみ。RLS: profiles_update_own）。 */
export async function updateDisplayName(supabase: DB, displayName: string): Promise<ProfileRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  return unwrap(
    await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", auth.user.id)
      .select()
      .single(),
    "プロフィールの更新",
  );
}
