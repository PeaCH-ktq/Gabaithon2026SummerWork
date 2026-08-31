-- TanE: 初期スキーマ
-- 詳細な設計方針は doc/database.md を参照。

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create table shelves (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  course_name text not null,
  year int,
  term text,
  day_of_week smallint check (day_of_week between 0 and 6),
  period smallint,
  created_at timestamptz not null default now()
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  shelf_id uuid not null references shelves(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create table question_sets (
  id uuid primary key default gen_random_uuid(),
  shelf_id uuid not null references shelves(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  source_material_id uuid references materials(id) on delete set null,
  title text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table shelf_shares (
  id uuid primary key default gen_random_uuid(),
  shelf_id uuid not null references shelves(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (shelf_id, group_id)
);

create table question_set_shares (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references question_sets(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (question_set_id, group_id)
);

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  created_by uuid not null references profiles(id),
  title text not null,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  shelf_id uuid not null references shelves(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  created_by uuid not null references profiles(id),
  title text not null,
  due_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table assignment_reports (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  minutes_spent int not null check (minutes_spent >= 0),
  comment text,
  created_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create table google_credentials (
  user_id uuid primary key references profiles(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  study_session_id uuid not null references study_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  google_event_id text not null,
  created_at timestamptz not null default now(),
  unique (study_session_id, user_id)
);

create index on shelves (owner_id);
create index on materials (shelf_id);
create index on question_sets (shelf_id);
create index on shelf_shares (group_id);
create index on question_set_shares (group_id);
create index on group_members (user_id);
create index on study_sessions (group_id, starts_at);
create index on assignments (shelf_id, due_at);
create index on assignments (group_id);
create index on assignment_reports (assignment_id);
