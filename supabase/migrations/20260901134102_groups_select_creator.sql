-- TanE: グループ作成者が作成直後に自分のグループを読めるようにする。
--
-- groups_select_member は is_group_member(id) だけを見ているため、
-- `insert into groups (...) returning *`（PostgREST の .insert().select()）が
-- RETURNING 行に SELECT ポリシーを適用したときに弾かれる:
--   ERROR: new row violates row-level security policy for table "groups"
-- AFTER INSERT トリガー（handle_new_group）が group_members を入れても、
-- 同一ステートメント内の is_group_member（STABLE）はそれを見ないため。
--
-- 作成者本人は常に自分のグループを読めてよいので、created_by も許可する。
-- role='owner' の判定（groups_update_owner / groups_delete_owner）は
-- 引き続き group_members に入る owner 行に依存する。

drop policy "groups_select_member" on groups;
create policy "groups_select_member" on groups for select using (
  is_group_member(id) or created_by = auth.uid()
);
