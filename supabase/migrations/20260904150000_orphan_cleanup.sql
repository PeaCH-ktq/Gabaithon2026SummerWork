-- TanE: 削除経路に残っていた孤立データの解消。
-- 詳細な精査結果は doc/database.md「削除経路と孤立データ」節を参照。
--
-- ここで扱うのは 3 点:
--   #1 created_by 系 FK の ON DELETE 未指定 → アカウントが削除できない
--   #4 question_sets.source_material_ids のダングリング資料 ID
--   （#5 question_set_shares の掃除は 20260904140000 の
--     cleanup_unshared_assignments() へ同居させた）

-- 1) created_by 系 FK。0001_init.sql では references profiles(id) だけで
--    ON DELETE を指定していなかった（= NO ACTION）。そのため、グループ・勉強会・
--    課題を1つでも作ったユーザーは profiles の削除が FK 違反で失敗し、
--    auth.users ごと消せない（Supabase ダッシュボードからも削除不可）。

-- グループ: 作成者が消えてもグループは残す。groups_select_member の
-- created_by = auth.uid() 分岐は is_group_member があるので null でも破綻しない。
alter table groups alter column created_by drop not null;
alter table groups drop constraint groups_created_by_fkey;
alter table groups add constraint groups_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

-- 作成者が null のグループでも handle_new_group が落ちないようにする。
create or replace function handle_new_group() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then
    return new;
  end if;
  insert into group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;
-- 純粋なトリガー関数なので RPC 経由で呼ばせない（advisor 0028/0029 対策）。
-- Supabase は anon / authenticated に EXECUTE を明示的に GRANT するため、
-- `from public` だけでは足りずロール名を挙げる必要がある。
revoke execute on function handle_new_group() from public, anon, authenticated;

-- 勉強会: 作成者が消えたら予定ごと消す。キャンセル権限（study_sessions_delete_own）が
-- created_by 依存なので、SET NULL にすると誰にも消せない予定が残ってしまう。
-- calendar_events は FK カスケードで消えるが、Google 側のイベントは
-- app/api/groups/[id]/leave が脱退時に取り消す。
alter table study_sessions drop constraint study_sessions_created_by_fkey;
alter table study_sessions add constraint study_sessions_created_by_fkey
  foreign key (created_by) references profiles(id) on delete cascade;

-- 課題: 他人が作った課題を巻き添えで消さないよう SET NULL。
-- 20260904140000 で assignments_update_own / _delete_own に棚の所有者を
-- 追加済みなので、created_by が null になっても手が付けられなくなることはない。
alter table assignments alter column created_by drop not null;
alter table assignments drop constraint assignments_created_by_fkey;
alter table assignments add constraint assignments_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

-- 2) 資料削除時に question_sets.source_material_ids からも ID を取り除く。
--    この列は複数資料からの生成を記録するためのもので FK が張れない
--    （20260904130000）。source_material_id 側は FK の on delete set null で
--    処理されるが、配列側は放置され削除済み資料の UUID が残り続けていた。
create function cleanup_question_set_material_refs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update question_sets
     set source_material_ids = nullif(array_remove(source_material_ids, old.id), '{}')
   where source_material_ids @> array[old.id];
  return old;
end;
$$;
revoke execute on function cleanup_question_set_material_refs() from public, anon, authenticated;

create trigger on_material_deleted
  after delete on materials
  for each row execute function cleanup_question_set_material_refs();

-- 3) 既存の不整合を掃除する（20260904120000 の 5) と同じ体裁）。

-- 削除済み資料の ID を配列から除去。
update question_sets q
   set source_material_ids = nullif(
     array(
       select mid from unnest(q.source_material_ids) as mid
        where exists (select 1 from materials m where m.id = mid)
     ),
     '{}'
   )
 where q.source_material_ids is not null
   and exists (
     select 1 from unnest(q.source_material_ids) as mid
      where not exists (select 1 from materials m where m.id = mid)
   );

-- 棚が共有されていないグループ向けの question_set_shares を削除。
delete from question_set_shares qs
 using question_sets q
 where qs.question_set_id = q.id
   and not exists (
     select 1 from shelf_shares f
      where f.shelf_id = q.shelf_id and f.group_id = qs.group_id
   );

-- 棚が共有されていないグループ向けの assignment_shares を削除。
delete from assignment_shares sh
 using assignments a
 where sh.assignment_id = a.id
   and not exists (
     select 1 from shelf_shares f
      where f.shelf_id = a.shelf_id and f.group_id = sh.group_id
   );

-- 共有先が1件も残らず、作成者が棚の所有者でもない課題を削除（reports は cascade）。
delete from assignments a
 where not exists (select 1 from assignment_shares sh where sh.assignment_id = a.id)
   and not exists (
     select 1 from shelves s
      where s.id = a.shelf_id and s.owner_id is not distinct from a.created_by
   );

-- グループのメンバーでなくなった人の calendar_events を削除。
-- （Google 側のイベントはここからは消せない。以降は脱退 Route Handler が取り消す。）
delete from calendar_events ce
 where not exists (
   select 1 from study_sessions ss
   join group_members gm on gm.group_id = ss.group_id
   where ss.id = ce.study_session_id and gm.user_id = ce.user_id
 );
