-- TanE: グループ（作成・参加・メンバー）と共有（shelf_shares / question_set_shares）の
-- UI 接続に向けた RLS 修正。詳細は doc/database.md タスク 6 / 7 を参照。

-- 1) shelf_shares に UPDATE ポリシーが存在しなかった（0002_rls.sql は select/insert/delete のみ）。
--    このままだと lib/data/shares.ts:setShelfVisible が 0 行更新で無言失敗する。
create policy "shelf_shares_update" on shelf_shares for update
  using      (exists (select 1 from shelves where shelves.id = shelf_id and shelves.owner_id = auth.uid()))
  with check (exists (select 1 from shelves where shelves.id = shelf_id and shelves.owner_id = auth.uid()));

-- 2) 「棚を共有すると、その棚の問題集もすべて共有される」を RLS で表現する。
--    shelf_shares_select は is_group_member(group_id) だけを見ており question_sets を参照しないため、
--    ここから shelf_shares を引いても相互再帰しない。既存パターン（is_group_member 等）に合わせ
--    SECURITY DEFINER 関数に切り出す。
create function is_shelf_shared(sid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from shelf_shares
    where shelf_id = sid and visible = true and is_group_member(group_id)
  );
$$;

drop policy "question_sets_select" on question_sets;
create policy "question_sets_select" on question_sets for select using (
  owner_id = auth.uid()
  or is_shelf_shared(shelf_id)
  or exists (                                   -- 個別の question_set_shares（将来用）は残す
    select 1 from question_set_shares
    where question_set_shares.question_set_id = question_sets.id
      and is_group_member(question_set_shares.group_id)
  )
);
