-- Pași (subtask-uri) pe sarcină: checklist cu bife, pentru procedurile cu etape
-- (ex. întocmire → expediere demers → examinare).

create table if not exists subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position int not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists subtasks_task_idx on subtasks (task_id, position);

alter table subtasks enable row level security;

drop policy if exists "subtasks select" on subtasks;
create policy "subtasks select" on subtasks
  for select using (auth.role() = 'authenticated');

-- Scriere doar de cine poate edita sarcina (creator / responsabil / admin).
drop policy if exists "subtasks write" on subtasks;
create policy "subtasks write" on subtasks
  for all
  using (
    exists (
      select 1 from tasks t
      where t.id = subtasks.task_id
        and (is_admin() or t.created_by = auth.uid() or t.assignee_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from tasks t
      where t.id = subtasks.task_id
        and (is_admin() or t.created_by = auth.uid() or t.assignee_id = auth.uid())
    )
  );
