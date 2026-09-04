-- TanE: 課題を複数グループへ同時共有できるようにする。
--
-- 背景: assignments.group_id はスカラ1列しか無く、lib/data/assignments.ts の
-- pickAssignmentGroupId が「可視共有先がちょうど1件のときだけ共有、0件・複数件なら
-- 個人課題(null)」という妥協をしていた。そのため棚を2グループ以上へ共有すると、
-- そこに作った課題がどのグループにも表示されなくなっていた。
--
-- 方針: group_id を assignment_shares(assignment_id, group_id) 中間テーブルへ移す。
-- 表示可否の判定は 20260904120000 で導入した「棚が可視共有されている間だけ見える」
-- ライブ判定をそのまま多対多へ持ち上げる（is_assignment_visible）。

create table assignment_shares (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (assignment_id, group_id)
);
create index on assignment_shares (group_id);

alter table assignment_shares enable row level security;

-- 既存の group_id を移行してから列を落とす（末尾）。
insert into assignment_shares (assignment_id, group_id)
select id, group_id from assignments where group_id is not null;

-- 1) SECURITY DEFINER 関数群。
--    assignment_shares のポリシーが assignments を、assignments のポリシーが
--    assignment_shares を参照すると相互再帰するため、既存の owns_question_set /
--    is_shelf_shared_to と同じくすべて関数へ逃がす。

-- 課題の作成者か。
create function owns_assignment(aid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from assignments where id = aid and created_by = auth.uid()
  );
$$;

-- 課題の載っている棚の所有者か。
create function owns_assignment_shelf(aid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from assignments a
    join shelves s on s.id = a.shelf_id
    where a.id = aid and s.owner_id = auth.uid()
  );
$$;

-- 課題の棚が、指定グループへ「可視」共有されているか。
-- assignment_shares の insert チェックで使う（棚 ID は assignment_id からしか引けない）。
create function assignment_shelf_shared_to(aid uuid, gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from assignments a
    join shelf_shares f on f.shelf_id = a.shelf_id
    where a.id = aid and f.group_id = gid and f.visible = true
  );
$$;

-- 課題が自分に見えるか（共有先のどれか1つでも「自分がメンバー かつ 棚が可視共有中」を満たす）。
create function is_assignment_visible(aid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from assignment_shares sh
    join assignments a on a.id = sh.assignment_id
    where sh.assignment_id = aid
      and is_group_member(sh.group_id)
      and is_shelf_shared_to(a.shelf_id, sh.group_id)
  );
$$;

-- 2) ポリシーを group_id 基準から assignment_shares 基準へ張り替える。

drop policy "assignments_select" on assignments;
create policy "assignments_select" on assignments for select using (
  is_assignment_visible(id)
  or exists (
    select 1 from shelves
    where shelves.id = shelf_id and shelves.owner_id = auth.uid()
  )
);

-- 見えない棚に課題を作らせない。共有先の指定は assignment_shares 側で検査する。
drop policy "assignments_insert" on assignments;
create policy "assignments_insert" on assignments for insert with check (
  created_by = auth.uid()
  and (
    exists (select 1 from shelves where shelves.id = shelf_id and shelves.owner_id = auth.uid())
    or is_shelf_shared(shelf_id)
  )
);

-- created_by を SET NULL 可能にする（20260904150000）ため、棚の所有者にも
-- 更新・削除を許す。これが無いと作成者のアカウント削除後に手が付けられない
-- 課題が残る（doc/database.md 孤立 #6）。
drop policy "assignments_update_own" on assignments;
create policy "assignments_update_own" on assignments for update using (
  created_by = auth.uid()
  or exists (select 1 from shelves where shelves.id = shelf_id and shelves.owner_id = auth.uid())
);

drop policy "assignments_delete_own" on assignments;
create policy "assignments_delete_own" on assignments for delete using (
  created_by = auth.uid()
  or exists (select 1 from shelves where shelves.id = shelf_id and shelves.owner_id = auth.uid())
);

drop policy "assignment_reports_select" on assignment_reports;
create policy "assignment_reports_select" on assignment_reports for select using (
  is_assignment_visible(assignment_id)
);

-- assignment_shares 自身。
create policy "assignment_shares_select" on assignment_shares for select using (
  is_group_member(group_id) or owns_assignment(assignment_id)
);

-- insert に assignment_shelf_shared_to が必須。これが無いと、所属グループでさえあれば
-- 「共有していない棚」の課題にも共有行を挿せてしまう。is_assignment_visible が
-- is_shelf_shared_to を要求するので画面には出ないが、on_shelf_unshared は
-- shelf_shares の「削除」で発火するトリガーなので、そもそも共有が存在しなかった
-- ケースでは永久に発火せず、どの掃除経路にも拾われない不可視の孤児行が残る。
create policy "assignment_shares_insert" on assignment_shares for insert with check (
  owns_assignment(assignment_id)
  and is_group_member(group_id)
  and assignment_shelf_shared_to(assignment_id, group_id)
);

create policy "assignment_shares_delete" on assignment_shares for delete using (
  owns_assignment(assignment_id) or owns_assignment_shelf(assignment_id)
);

-- 3) 共有解除トリガーを多対多向けに作り直す。
--    (棚, グループ) の共有行が消えたら、その組の assignment_shares を落とし、
--    どのグループからも見えなくなった課題だけを物理削除する。
--    棚の所有者が作った課題は「個人課題」として残す（所有者には常に見えるため）。
--
--    あわせて question_set_shares も掃除する（doc/database.md 孤立 #5）。
--    従来この関数は assignments しか見ておらず、棚の共有を解除しても
--    その棚の問題集に対する個別共有だけが取り残されていた。現状 UI は
--    question_set_shares へ書き込まないため潜在バグだが、shareQuestionSet を
--    使い始めた瞬間に孤児化する。
create or replace function cleanup_unshared_assignments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from assignment_shares sh
  using assignments a
  where sh.assignment_id = a.id
    and a.shelf_id = old.shelf_id
    and sh.group_id = old.group_id;

  delete from assignments a
  where a.shelf_id = old.shelf_id
    and not exists (
      select 1 from assignment_shares sh where sh.assignment_id = a.id
    )
    and not exists (
      select 1 from shelves s
      where s.id = a.shelf_id and s.owner_id is not distinct from a.created_by
    );

  delete from question_set_shares qs
  using question_sets q
  where qs.question_set_id = q.id
    and q.shelf_id = old.shelf_id
    and qs.group_id = old.group_id;

  return old;
end;
$$;
revoke execute on function cleanup_unshared_assignments() from public;

-- 4) 移行が済んだので列を落とす。
alter table assignments drop column group_id;
