-- Registru de petiții — modul separat de sarcini.
-- Termen de răspuns = data înregistrării + 27 de zile (a 27-a zi = ultima),
-- calculat automat (coloană generată). Nr. de înregistrare unic, ex. "M-535/26".

create table if not exists petitions (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  petitioner text not null,
  petitioner_type text not null default 'detinut'
    check (petitioner_type in ('detinut', 'avocat', 'civil')),
  subject text,
  received_date date not null default current_date,
  response_deadline date generated always as (received_date + 27) stored,
  status text not null default 'in_examinare'
    check (status in ('in_examinare', 'solutionat')),
  response text,
  response_date date,
  assignee_id uuid references profiles(id) on delete set null,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists petitions_deadline_idx on petitions (response_deadline);

drop trigger if exists petitions_updated_at on petitions;
create trigger petitions_updated_at before update on petitions
  for each row execute function set_updated_at();

alter table petitions enable row level security;

drop policy if exists "petitions select authenticated" on petitions;
create policy "petitions select authenticated" on petitions
  for select using (auth.role() = 'authenticated');

drop policy if exists "petitions insert" on petitions;
create policy "petitions insert" on petitions
  for insert with check (is_admin() or created_by = auth.uid());

drop policy if exists "petitions update" on petitions;
create policy "petitions update" on petitions
  for update using (is_admin() or created_by = auth.uid() or assignee_id = auth.uid())
  with check (is_admin() or created_by = auth.uid() or assignee_id = auth.uid());

drop policy if exists "petitions delete" on petitions;
create policy "petitions delete" on petitions
  for delete using (is_admin() or created_by = auth.uid());
