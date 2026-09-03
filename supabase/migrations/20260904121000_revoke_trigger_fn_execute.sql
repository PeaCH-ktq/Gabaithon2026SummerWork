-- トリガー専用関数を RPC 経由で叩けないようにする。
-- （トリガー発火時の実行に EXECUTE 権限は不要。Supabase の DB linter
--  anon/authenticated_security_definer_function_executable 対策）
revoke execute on function cleanup_unshared_assignments() from public;
revoke execute on function delete_empty_group() from public;
