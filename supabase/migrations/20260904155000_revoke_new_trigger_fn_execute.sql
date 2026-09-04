-- トリガー専用関数を RPC 経由で叩けないようにする（advisor 0028/0029 対策）。
-- Supabase は anon / authenticated に EXECUTE を明示 GRANT するため、
-- `from public` だけでは足りずロール名を挙げる必要がある
-- （20260903120000 の delete_empty_group と同じ形）。
revoke execute on function cleanup_question_set_material_refs() from public, anon, authenticated;
revoke execute on function handle_new_group() from public, anon, authenticated;
