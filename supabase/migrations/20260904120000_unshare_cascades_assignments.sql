-- TanE: 課題と学習記録を「棚の共有状態」に正しく追従させる。
--
-- これまで assignments_select / assignment_reports_select は
-- assignments.group_id（課題作成時に pickAssignmentGroupId で焼き込まれ、その後不変）
-- だけを見ていた。そのため:
--   * 棚の共有を「解除」しても shelf_shares 行が消えるだけで、グループメンバーには
--     課題も学習記録（assignment_reports）も見え続けた。
--   * 棚を「非表示」(visible=false) にしても課題・学習記録は隠れなかった。
--   * 共有が切れた課題行・レポート行が DB に孤児として残り続けた。
--
-- 方針:
--   * 非表示  … RLS を可視共有 (is_shelf_shared_to) 基準にして「隠すだけ」。戻せば復活。
--   * 共有解除 … shelf_shares 行の削除をトリガーにして、その (棚, グループ) 向けの
--                assignments を物理削除。assignment_reports は FK カスケードで消える。
--   * グループ削除 … assignments.group_id を SET NULL → CASCADE に変更し、課題ごと消す。

-- 1) 棚が指定グループへ「可視」共有されているか。shelf_shares だけを参照するので
--    既存の is_shelf_shared / is_group_member と同じく相互再帰しない。
create function is_shelf_shared_to(sid uuid, gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from shelf_shares
    where shelf_id = sid and group_id = gid and visible = true
  );
$$;

-- 2) SELECT ポリシーを可視共有基準に張り替える。
drop policy "assignments_select" on assignments;
create policy "assignments_select" on assignments for select using (
  (
    group_id is not null
    and is_group_member(group_id)
    and is_shelf_shared_to(shelf_id, group_id)
  )
  or exists (
    select 1 from shelves
    where shelves.id = shelf_id and shelves.owner_id = auth.uid()
  )
);

drop policy "assignment_reports_select" on assignment_reports;
create policy "assignment_reports_select" on assignment_reports for select using (
  exists (
    select 1 from assignments
    where assignments.id = assignment_id
      and assignments.group_id is not null
      and is_group_member(assignments.group_id)
      and is_shelf_shared_to(assignments.shelf_id, assignments.group_id)
  )
);

-- 3) 共有解除（shelf_shares 行の削除）で、その (棚, グループ) 向けの課題を物理削除。
--    app / 直接 SQL / 棚削除やグループ削除の FK カスケードなど、経路を問わず効かせる。
--    SECURITY DEFINER で RLS を跨ぎ、他メンバーが作成した課題も掃除できる。
create function cleanup_unshared_assignments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from assignments
  where shelf_id = old.shelf_id
    and group_id = old.group_id;
  return old;
end;
$$;
revoke execute on function cleanup_unshared_assignments() from anon, authenticated;

create trigger on_shelf_unshared
  after delete on shelf_shares
  for each row execute function cleanup_unshared_assignments();

-- 4) グループ削除時、共有されていた課題を個人課題化せず課題ごと消す。
alter table assignments drop constraint assignments_group_id_fkey;
alter table assignments add constraint assignments_group_id_fkey
  foreign key (group_id) references groups(id) on delete cascade;

-- 5) 既存の不整合掃除: 共有 (shelf_shares 行) が存在しないのに group_id が残っている
--    課題を削除する（visible=false の「非表示中」共有は残す）。reports は FK カスケード。
delete from assignments a
where a.group_id is not null
  and not exists (
    select 1 from shelf_shares s
    where s.shelf_id = a.shelf_id and s.group_id = a.group_id
  );
