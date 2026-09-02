import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Shelf, ShelfShare } from "@/app/types";
import { unwrap } from "./utils";

type DB = SupabaseClient<Database>;
type ShelfRow = Database["public"]["Tables"]["shelves"]["Row"];
type ShelfInsert = Database["public"]["Tables"]["shelves"]["Insert"];
type ShelfUpdate = Database["public"]["Tables"]["shelves"]["Update"];

/**
 * 自分に見える棚の一覧（本人所有＋可視共有された棚。RLS が絞る）。
 *
 * 件数・共有先は PostgREST の埋め込み集計を使わず、単純クエリ4本を JS で畳む。
 * `lib/supabase/types.ts` の `Relationships: []` が手書きのままだと
 * 埋め込み（`materials(count)` 等）で型推論が壊れるため。
 * `supabase gen types` へ移行したら埋め込み集計に置き換えてよい。
 *
 * RLS 由来の仕様:
 * - `materials_all_own` により、他人から共有された棚の materialCount は必ず 0
 *   （講義資料は共有しない設計なので正しい）。
 * - `shelf_shares_select` は `is_group_member` 前提なので、sharedGroupIds には
 *   「自分が所属するグループへの共有」だけが載る。
 */
export async function listShelves(supabase: DB): Promise<Shelf[]> {
  const shelves = unwrap(
    await supabase.from("shelves").select("*").order("created_at", { ascending: true }),
    "棚の取得",
  );
  const materials = unwrap(
    await supabase.from("materials").select("shelf_id"),
    "資料件数の取得",
  );
  const questionSets = unwrap(
    await supabase.from("question_sets").select("shelf_id"),
    "問題集件数の取得",
  );
  const shares = unwrap(
    await supabase.from("shelf_shares").select("shelf_id, group_id, visible"),
    "共有情報の取得",
  );

  const materialCount = countBy(materials, (r) => r.shelf_id);
  const questionSetCount = countBy(questionSets, (r) => r.shelf_id);
  const sharesByShelf = new Map<string, ShelfShare[]>();
  for (const s of shares) {
    const list = sharesByShelf.get(s.shelf_id) ?? [];
    list.push({ group_id: s.group_id, visible: s.visible });
    sharesByShelf.set(s.shelf_id, list);
  }

  return shelves.map((row: ShelfRow) => {
    const shelfShares = sharesByShelf.get(row.id) ?? [];
    return {
      ...row,
      materialCount: materialCount.get(row.id) ?? 0,
      questionSetCount: questionSetCount.get(row.id) ?? 0,
      shares: shelfShares,
      sharedGroupIds: shelfShares.map((s) => s.group_id),
    };
  });
}

export async function getShelf(supabase: DB, id: string): Promise<ShelfRow> {
  return unwrap(
    await supabase.from("shelves").select("*").eq("id", id).single(),
    "棚の取得",
  );
}

export async function createShelf(
  supabase: DB,
  input: Omit<ShelfInsert, "owner_id">,
): Promise<ShelfRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です。");
  return unwrap(
    await supabase
      .from("shelves")
      .insert({ ...input, owner_id: auth.user.id })
      .select()
      .single(),
    "棚の作成",
  );
}

export async function updateShelf(
  supabase: DB,
  id: string,
  patch: ShelfUpdate,
): Promise<ShelfRow> {
  return unwrap(
    await supabase.from("shelves").update(patch).eq("id", id).select().single(),
    "棚の更新",
  );
}

export async function deleteShelf(supabase: DB, id: string): Promise<void> {
  const { error } = await supabase.from("shelves").delete().eq("id", id);
  if (error) {
    console.error("[data] 棚の削除", error);
    throw new Error("棚の削除に失敗しました。");
  }
}

function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}
