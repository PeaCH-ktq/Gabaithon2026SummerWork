-- TanE: UI 整合のためのスキーマ差分
-- 詳細は doc/database.md「今後のタスク 1」を参照。
--
-- 1) shelves に UI が必要とする列を追加（講義コード・担当教員・教室・タブ色）
-- 2) groups への insert 直後に作成者を owner として group_members へ入れるトリガー

alter table shelves
  add column course_code text,
  add column professor   text,
  add column room        text,
  add column color       text not null default '#5866c5';

-- groups への insert 直後に、作成者を owner として group_members へ入れる。
-- これが無いと groups_select_member（is_group_member）に落ち、
-- 作成者が自分の作ったグループを select できない（doc/database.md 落とし穴 1）。
-- group_members には insert ポリシーが無いため security definer が必須。
create function handle_new_group() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_group_created
  after insert on groups
  for each row execute function handle_new_group();
