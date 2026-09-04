-- Bucket privat pentru fișierele-sursă de raportare (xlsx, max 10 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'statistics', 'statistics', false, 10485760,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists stat_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'r_lunar', 'liberati', 'amnistia_2016', 'amnistia_2021',
    'gratiere', 'comisia', 'mc', 'sedinte'
  )),
  period_date date not null,
  period_type text not null check (period_type in ('saptamanal', 'lunar')),
  file_path text,
  file_name text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, period_date, period_type)
);
create index if not exists stat_reports_kind_period_idx
  on stat_reports (kind, period_date);

create table if not exists stat_values (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references stat_reports(id) on delete cascade,
  indicator text not null,
  series text not null default 'cumulat' check (series in ('cumulat', 'perioada')),
  value numeric,
  position integer not null default 0
);
create index if not exists stat_values_report_idx on stat_values (report_id);
create index if not exists stat_values_indicator_idx on stat_values (indicator);

alter table stat_reports enable row level security;
alter table stat_values enable row level security;

-- Citire: orice autentificat. Scriere: doar admin (date de raportare instituțională).
drop policy if exists "stat_reports select" on stat_reports;
create policy "stat_reports select" on stat_reports
  for select using (auth.role() = 'authenticated');
drop policy if exists "stat_reports write" on stat_reports;
create policy "stat_reports write" on stat_reports
  for all using (is_admin()) with check (is_admin());

drop policy if exists "stat_values select" on stat_values;
create policy "stat_values select" on stat_values
  for select using (auth.role() = 'authenticated');
drop policy if exists "stat_values write" on stat_values;
create policy "stat_values write" on stat_values
  for all using (is_admin()) with check (is_admin());

-- Storage: citire pentru autentificați, scriere doar admin.
drop policy if exists "statistics bucket select" on storage.objects;
create policy "statistics bucket select" on storage.objects
  for select using (bucket_id = 'statistics' and auth.role() = 'authenticated');
drop policy if exists "statistics bucket insert" on storage.objects;
create policy "statistics bucket insert" on storage.objects
  for insert with check (bucket_id = 'statistics' and is_admin());
drop policy if exists "statistics bucket delete" on storage.objects;
create policy "statistics bucket delete" on storage.objects
  for delete using (bucket_id = 'statistics' and is_admin());
