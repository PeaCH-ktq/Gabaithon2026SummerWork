-- TanE: 課題の SELECT ポリシーに「作成者本人」の枝を足す。
--
-- 背景: 20260904140000 の assignments_select は
--   is_assignment_visible(id) or 棚の所有者
-- だけで、作成者本人の枝が無かった。lib/data/assignments.ts:createAssignment は
-- insert の直後に `.select().single()` で行を読み戻すが、この時点では
-- assignment_shares 行がまだ無いので is_assignment_visible は false。
-- 棚の所有者でないメンバーが「共有された講義」に課題を作ると RETURNING が
-- SELECT ポリシーに弾かれ、課題の作成そのものが失敗していた
-- （assignments_insert は is_shelf_shared を許しているので insert 自体は通る）。
--
-- 同じ理由で「共有された講義に共有先0件の個人課題を作る」と、作成者本人にすら
-- 見えない行になっていた。
--
-- 棚の共有が解除されたときは cleanup_unshared_assignments が
-- 「共有0件かつ作成者≠棚の所有者」の課題を物理削除するので、この枝を足しても
-- 共有解除後に見え続ける課題は残らない。
drop policy "assignments_select" on assignments;
create policy "assignments_select" on assignments for select using (
  created_by = auth.uid()
  or is_assignment_visible(id)
  or exists (
    select 1 from shelves
    where shelves.id = shelf_id and shelves.owner_id = auth.uid()
  )
);
