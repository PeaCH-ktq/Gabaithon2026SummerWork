-- TanE: RLS ポリシー
-- 詳細な設計方針は doc/database.md を参照。

-- グループ関連ポリシーの自己再帰を避けるための SECURITY DEFINER 関数。
-- group_members を直接参照するポリシーを group_members 自身に書くと無限再帰になるため、
-- 全てのグループ関連ポリシーはこの関数を経由する。
create function is_group_member(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- 招待コードでの参加は「コードを知っている人だけ」を RLS だけでは表現できないため、
-- この関数経由に限定する（group_members への直接 insert は許可しない）。
create function join_group_by_code(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target_group_id uuid;
begin
  select id into target_group_id from groups where invite_code = code;

  if target_group_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into group_members (group_id, user_id, role)
  values (target_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return target_group_id;
end;
$$;

alter table profiles enable row level security;
alter table shelves enable row level security;
alter table materials enable row level security;
alter table question_sets enable row level security;
alter table question_set_shares enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table shelf_shares enable row level security;
alter table study_sessions enable row level security;
alter table assignments enable row level security;
alter table assignment_reports enable row level security;
alter table google_credentials enable row level security;
alter table calendar_events enable row level security;

-- profiles: 表示名解決のため全員が読める。書き込みは本人のみ。
create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

-- materials: 著作権のため所有者本人のみ（共有しない）。
create policy "materials_all_own" on materials for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- shelves: 本人、または shelf_shares 経由で見える化されたグループのメンバー。
create policy "shelves_select" on shelves for select using (
  owner_id = auth.uid()
  or exists (
    select 1 from shelf_shares
    where shelf_shares.shelf_id = shelves.id
      and shelf_shares.visible = true
      and is_group_member(shelf_shares.group_id)
  )
);
create policy "shelves_write_own" on shelves for insert with check (owner_id = auth.uid());
create policy "shelves_update_own" on shelves for update using (owner_id = auth.uid());
create policy "shelves_delete_own" on shelves for delete using (owner_id = auth.uid());

-- question_sets: 本人、または question_set_shares 経由でメンバー。
create policy "question_sets_select" on question_sets for select using (
  owner_id = auth.uid()
  or exists (
    select 1 from question_set_shares
    where question_set_shares.question_set_id = question_sets.id
      and is_group_member(question_set_shares.group_id)
  )
);
create policy "question_sets_write_own" on question_sets for insert with check (owner_id = auth.uid());
create policy "question_sets_update_own" on question_sets for update using (owner_id = auth.uid());
create policy "question_sets_delete_own" on question_sets for delete using (owner_id = auth.uid());

-- question_set_shares: 対象問題集の所有者のみが共有を作成・削除できる。閲覧はメンバー。
create policy "question_set_shares_select" on question_set_shares for select using (
  is_group_member(group_id)
  or exists (select 1 from question_sets where question_sets.id = question_set_id and question_sets.owner_id = auth.uid())
);
create policy "question_set_shares_write" on question_set_shares for insert with check (
  exists (select 1 from question_sets where question_sets.id = question_set_id and question_sets.owner_id = auth.uid())
);
create policy "question_set_shares_delete" on question_set_shares for delete using (
  exists (select 1 from question_sets where question_sets.id = question_set_id and question_sets.owner_id = auth.uid())
);

-- groups: メンバーのみ閲覧。作成は誰でも可、更新・削除は owner ロールのみ。
create policy "groups_select_member" on groups for select using (is_group_member(id));
create policy "groups_insert_any" on groups for insert with check (created_by = auth.uid());
create policy "groups_update_owner" on groups for update using (
  exists (select 1 from group_members where group_id = id and user_id = auth.uid() and role = 'owner')
);
create policy "groups_delete_owner" on groups for delete using (
  exists (select 1 from group_members where group_id = id and user_id = auth.uid() and role = 'owner')
);

-- group_members: 参加は join_group_by_code 経由のみ（直接 insert は許可しない）。脱退は本人。
create policy "group_members_select" on group_members for select using (is_group_member(group_id));
create policy "group_members_delete_self" on group_members for delete using (user_id = auth.uid());

-- shelf_shares: メンバーは閲覧可、共有の作成・削除は対象棚の所有者のみ。
create policy "shelf_shares_select" on shelf_shares for select using (is_group_member(group_id));
create policy "shelf_shares_write" on shelf_shares for insert with check (
  exists (select 1 from shelves where shelves.id = shelf_id and shelves.owner_id = auth.uid())
);
create policy "shelf_shares_delete" on shelf_shares for delete using (
  exists (select 1 from shelves where shelves.id = shelf_id and shelves.owner_id = auth.uid())
);

-- study_sessions: メンバーが閲覧・作成でき、更新・削除は作成者のみ。
create policy "study_sessions_select" on study_sessions for select using (is_group_member(group_id));
create policy "study_sessions_insert" on study_sessions for insert with check (
  is_group_member(group_id) and created_by = auth.uid()
);
create policy "study_sessions_update_own" on study_sessions for update using (created_by = auth.uid());
create policy "study_sessions_delete_own" on study_sessions for delete using (created_by = auth.uid());

-- assignments: グループのメンバー、または対象棚の所有者が閲覧可。作成はメンバー、更新・削除は作成者。
create policy "assignments_select" on assignments for select using (
  (group_id is not null and is_group_member(group_id))
  or exists (select 1 from shelves where shelves.id = shelf_id and shelves.owner_id = auth.uid())
);
create policy "assignments_insert" on assignments for insert with check (
  created_by = auth.uid()
  and (group_id is null or is_group_member(group_id))
);
create policy "assignments_update_own" on assignments for update using (created_by = auth.uid());
create policy "assignments_delete_own" on assignments for delete using (created_by = auth.uid());

-- assignment_reports: 対象課題のグループのメンバーが閲覧可。書き込みは本人の行のみ。
create policy "assignment_reports_select" on assignment_reports for select using (
  exists (
    select 1 from assignments
    where assignments.id = assignment_id
      and assignments.group_id is not null
      and is_group_member(assignments.group_id)
  )
);
create policy "assignment_reports_write_own" on assignment_reports for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- google_credentials / calendar_events: クライアントには一切公開しない。
-- ポリシーを作らないことで全アクセスを拒否し、service-role キーを持つサーバー側からのみ操作する。

-- Storage: materials バケットは本人のみアクセス可能。
-- パス規則: {user_id}/{material_id}/{file_name}
create policy "materials_storage_own" on storage.objects for all
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
