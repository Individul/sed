-- Enums
create type task_status as enum ('todo', 'in_progress', 'done');
create type task_priority as enum ('low', 'medium', 'high');

-- profiles (oglindește auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text default 'member',
  created_at timestamptz default now()
);

-- tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  due_date date,
  assignee_id uuid references profiles(id) on delete set null,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- tags
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#64748b'
);

create table task_tags (
  task_id uuid references tasks(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

-- comments
create table comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

-- trigger updated_at pe tasks
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

-- creare automată profil la sign-up
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- backfill: creează profiluri pentru userii deja existenți la momentul migrării
-- (triggerul de mai sus acoperă doar userii adăugați DUPĂ migrare)
insert into public.profiles (id, full_name, avatar_url)
select id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;

-- RLS
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table tags enable row level security;
alter table task_tags enable row level security;
alter table comments enable row level security;

-- profiles
create policy "profiles readable by authenticated" on profiles
  for select using (auth.role() = 'authenticated');
create policy "update own profile" on profiles
  for update using (auth.uid() = id);

-- tasks: workspace comun
create policy "tasks select authenticated" on tasks
  for select using (auth.role() = 'authenticated');
create policy "tasks insert authenticated" on tasks
  for insert with check (auth.uid() = created_by);
create policy "tasks update authenticated" on tasks
  for update using (auth.role() = 'authenticated');
create policy "tasks delete authenticated" on tasks
  for delete using (auth.role() = 'authenticated');

-- tags & task_tags
create policy "tags all authenticated" on tags
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "task_tags all authenticated" on task_tags
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- comments
create policy "comments select authenticated" on comments
  for select using (auth.role() = 'authenticated');
create policy "comments insert own" on comments
  for insert with check (auth.uid() = author_id);
create policy "comments update own" on comments
  for update using (auth.uid() = author_id);
create policy "comments delete own" on comments
  for delete using (auth.uid() = author_id);
