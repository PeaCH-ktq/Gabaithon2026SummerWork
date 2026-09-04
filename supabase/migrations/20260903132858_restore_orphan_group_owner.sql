-- メンバーが0人になったまま残っているグループに、作成者を owner として復帰させる。
-- （delete_empty_group トリガー導入前に発生した孤立データの修復）
insert into group_members (group_id, user_id, role)
select g.id, g.created_by, 'owner'
from groups g
where not exists (select 1 from group_members m where m.group_id = g.id)
on conflict (group_id, user_id) do nothing;
