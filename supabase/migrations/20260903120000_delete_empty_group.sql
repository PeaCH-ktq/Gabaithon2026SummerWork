-- 空になったグループを自動削除する。
--
-- 背景: leaveGroup は group_members から自分の行を消すだけで、グループ本体を
-- 消す経路がどこにも無い。とくに owner が脱退すると role='owner' 行が消え、
-- groups_delete_owner ポリシーに合致する人が居なくなり孤児グループになる。
--
-- 方針: owner 概念を UI に持ち込まず（owner も自由に脱退できる）、
-- group_members の AFTER DELETE トリガーで残メンバー 0 件なら groups を消す。
-- 呼び出し元は一般ユーザーなので、groups_delete_owner を迂回するため
-- SECURITY DEFINER が必須（handle_new_group / join_group_by_code と同じ方針）。

create function delete_empty_group() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- groups の削除 → group_members への on delete cascade でこのトリガーが
  -- 再入する。ユーザーが直接 group_members を delete した場合だけ深さ 1 なので、
  -- それ以外（FK カスケード等の内部トリガー）は無視する。
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if not exists (select 1 from group_members where group_id = old.group_id) then
    delete from groups where id = old.group_id;
  end if;
  return null;
end;
$$;

-- 純粋なトリガー関数なので RPC 経由で直接呼ばせない（advisor 0028/0029 対策）。
revoke execute on function delete_empty_group() from anon, authenticated;

create trigger on_group_member_left
  after delete on group_members
  for each row execute function delete_empty_group();

-- owner 認可には依存しないため、削除ポリシーはメンバー全員に緩める。
-- （手動解散 UI を作る場合の入口。空グループの掃除自体は上のトリガーが担う。）
drop policy "groups_delete_owner" on groups;
create policy "groups_delete_member" on groups for delete using (is_group_member(id));
