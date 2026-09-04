-- Evidența rulărilor de backup. Fără ea, o copie care se oprește în tăcere e
-- mai rea decât lipsa uneia: te crezi acoperit tocmai când nu ești.

create table if not exists backup_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  tables_count integer not null default 0,
  rows_count integer not null default 0,
  -- Fișiere urcate la rularea asta, și câte mai sunt de recuperat. A doua cifră
  -- deosebește „merge, dar încă recuperează restanța" de „s-a stricat".
  files_uploaded integer not null default 0,
  files_pending integer not null default 0,
  error text
);

create index if not exists backup_runs_started_idx on backup_runs (started_at desc);

alter table backup_runs enable row level security;

-- Doar adminul citește. Scrierea o face exclusiv cheia de serviciu, care
-- ocolește RLS oricum — deci nu există politică de insert: nimeni din aplicație
-- nu poate falsifica o rulare reușită.
drop policy if exists "backup_runs select" on backup_runs;
create policy "backup_runs select" on backup_runs
  for select using (is_admin());
