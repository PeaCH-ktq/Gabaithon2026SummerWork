import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generateInviteCode, unwrap } from "./utils";

type DB = SupabaseClient<Database>;
type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type GroupMemberRow = Database["public"]["Tables"]["group_members"]["Row"];

/**
 * 自分が所属するグループ。
 *
 * `groups` を直接 select しない。`groups_select_member` ポリシーには
 * `created_by = auth.uid()` という抜け道があり、作成者が後から脱退しても
 * グループ自体は見え続けてしまう（中身だけ空になる「幽霊グループ」）ため、
 * `group_members` に実際に自分の行があるグループだけに絞る。
 */
export async function listMyGroups(supabase: DB): Promise<GroupRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");

  const memberships = unwrap(
    await supabase.from("group_members").select("group_id").eq("user_id", auth.user.id),
    "グループの取得",
  );
  if (memberships.length === 0) return [];

  return unwrap(
    await supabase
      .from("groups")
      .select("*")
      .in("id", memberships.map((m) => m.group_id))
      .order("created_at", { ascending: true }),
    "グループの取得",
  );
}

/** 指定グループのメンバー一覧（表示名つき）。 */
export async function listGroupMembers(
  supabase: DB,
  groupId: string,
): Promise<Array<GroupMemberRow & { display_name: string; avatar_url: string | null }>> {
  const members = unwrap(
    await supabase
      .from("group_members")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true }),
    "メンバーの取得",
  );
  if (members.length === 0) return [];

  const profiles = unwrap(
    await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", members.map((m) => m.user_id)),
    "プロフィールの取得",
  );
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return members.map((m) => ({
    ...m,
    display_name: byId.get(m.user_id)?.display_name ?? "（不明なユーザー）",
    avatar_url: byId.get(m.user_id)?.avatar_url ?? null,
  }));
}

/**
 * グループ作成。`invite_code` はクライアントで採番する。
 * 作成者を owner として `group_members` へ入れるのは DB トリガー
 * （`on_group_created` / `handle_new_group`）が行う。
 */
export async function createGroup(supabase: DB, name: string): Promise<GroupRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  return unwrap(
    await supabase
      .from("groups")
      .insert({
        name,
        invite_code: generateInviteCode(),
        created_by: auth.user.id,
      })
      .select()
      .single(),
    "グループの作成",
  );
}

/** 招待コードで参加。`group_members` への直接 insert は不可なので RPC 経由。 */
export async function joinGroupByCode(supabase: DB, code: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_group_by_code", { code });
  if (error) {
    console.error("[data] グループ参加", error);
    throw new Error("招待コードが正しくありません。");
  }
  return data;
}

/** グループから脱退（本人のみ）。 */
export async function leaveGroup(supabase: DB, groupId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", auth.user.id);
  if (error) {
    console.error("[data] グループ脱退", error);
    throw new Error("グループの脱退に失敗しました。");
  }
}
