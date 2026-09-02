-- TanE: Storage バケット定義
-- 詳細な設計方針は doc/database.md「Storage」節を参照。
-- storage.objects に対する本人限定ポリシー（materials_storage_own）は
-- 0002_rls.sql で定義済み。ここではバケット本体のみ作成する。
-- パス規則: {user_id}/{material_id}/{file_name}

insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;
