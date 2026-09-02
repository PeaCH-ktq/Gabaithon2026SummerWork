-- TanE: question_sets ⟷ question_set_shares の RLS 相互再帰を解消する。
--
-- 0002_rls.sql では:
--   question_sets_select        → question_set_shares を参照
--   question_set_shares_select  → question_sets を参照
-- となっており、クライアントから question_sets を SELECT すると
--   ERROR: infinite recursion detected in policy for relation "question_sets"
-- になる（group_members の自己再帰を is_group_member で回避しているのと同じ問題）。
--
-- question_set_shares 側の「対象問題集の所有者か」判定を SECURITY DEFINER 関数に逃がし、
-- question_set_shares → question_sets の RLS 依存を断ち切る。

create function owns_question_set(qs_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from question_sets
    where id = qs_id and owner_id = auth.uid()
  );
$$;

-- question_set_shares の 3 ポリシーを、question_sets を直接参照しない形に貼り直す。
drop policy "question_set_shares_select" on question_set_shares;
drop policy "question_set_shares_write" on question_set_shares;
drop policy "question_set_shares_delete" on question_set_shares;

create policy "question_set_shares_select" on question_set_shares for select using (
  is_group_member(group_id) or owns_question_set(question_set_id)
);
create policy "question_set_shares_write" on question_set_shares for insert with check (
  owns_question_set(question_set_id)
);
create policy "question_set_shares_delete" on question_set_shares for delete using (
  owns_question_set(question_set_id)
);
