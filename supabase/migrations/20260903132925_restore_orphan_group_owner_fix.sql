-- 前回のマイグレーションは「メンバー0人のグループ」だけを対象にしていたが、
-- 既に他メンバーが参加済みのグループは対象から漏れた。
-- 「作成者が group_members にいないグループ」を直接対象にして owner 行を復帰させる。
insert into group_members (group_id, user_id, role)
select g.id, g.created_by, 'owner'
from groups g
where not exists (
  select 1 from group_members m
  where m.group_id = g.id and m.user_id = g.created_by
)
on conflict (group_id, user_id) do nothing;
