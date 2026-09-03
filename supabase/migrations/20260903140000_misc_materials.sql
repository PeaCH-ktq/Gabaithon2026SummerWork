-- TanE: 「雑資料」（著作権に関係のない、グループ共有可能な資料）の追加。
-- 講義資料（kind='lecture'）は従来どおり本人のみ。雑資料（kind='misc'）は
-- 棚の共有（shelf_shares / is_shelf_shared）に連動してグループメンバーへ公開する。
-- 詳細は doc/database.md を参照。

-- 1) kind 列。既存行はすべて講義資料として扱う。
alter table materials
  add column kind text not null default 'lecture'
  check (kind in ('lecture', 'misc'));
create index on materials (shelf_id, kind);
-- Storage ポリシーからオブジェクト名 → materials 行を逆引きするために使う。
create unique index on materials (storage_path);

-- 2) 行の RLS を分割する。
drop policy "materials_all_own" on materials;

create policy "materials_select" on materials for select using (
  owner_id = auth.uid()
  or (kind = 'misc' and is_shelf_shared(shelf_id))
);
create policy "materials_insert_own" on materials for insert with check (owner_id = auth.uid());
create policy "materials_update_own" on materials for update using (owner_id = auth.uid());
create policy "materials_delete_own" on materials for delete using (owner_id = auth.uid());

-- 3) Storage。既存の materials_storage_own はパス先頭フォルダが auth.uid() の
--    ときだけ通すため、非所有者は共有された雑資料でも読めない。
--    SECURITY DEFINER 関数でオブジェクト名から materials を逆引きし、
--    読み取りだけ追加で許可する（is_group_member / is_shelf_shared と同じ形）。
create function is_shared_misc_material(object_name text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from materials
    where storage_path = object_name
      and kind = 'misc'
      and is_shelf_shared(shelf_id)
  );
$$;

create policy "materials_storage_shared_read" on storage.objects for select
  using (bucket_id = 'materials' and is_shared_misc_material(name));
