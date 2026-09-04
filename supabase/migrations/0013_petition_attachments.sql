-- Bucket privat pentru scanările petițiilor (PDF/JPG/PNG, max 10 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'petitions', 'petitions', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists petition_attachments (
  id uuid primary key default gen_random_uuid(),
  petition_id uuid not null references petitions(id) on delete cascade,
  kind text not null check (kind in ('petitie', 'raspuns')),
  path text not null unique,
  name text not null,
  mime text,
  size integer,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists petition_attachments_petition_idx
  on petition_attachments (petition_id);

alter table petition_attachments enable row level security;

-- Poate utilizatorul curent să modifice petiția? (aceeași regulă ca politica
-- „petitions update": admin / creator / responsabil)
create or replace function can_modify_petition(p_id uuid) returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from petitions p
    where p.id = p_id
      and (is_admin() or p.created_by = auth.uid() or p.assignee_id = auth.uid())
  );
$$;

drop policy if exists "petition_attachments select" on petition_attachments;
create policy "petition_attachments select" on petition_attachments
  for select using (auth.role() = 'authenticated');

drop policy if exists "petition_attachments insert" on petition_attachments;
create policy "petition_attachments insert" on petition_attachments
  for insert with check (
    can_modify_petition(petition_id) and uploaded_by = auth.uid()
  );

drop policy if exists "petition_attachments delete" on petition_attachments;
create policy "petition_attachments delete" on petition_attachments
  for delete using (can_modify_petition(petition_id));

-- ===== Storage: bucket „petitions" =====
-- Calea are forma {petition_id}/{fișier}, deci primul segment identifică petiția.
-- Dacă primul segment nu e un uuid valid, conversia eșuează și accesul e refuzat.
drop policy if exists "petitions bucket select" on storage.objects;
create policy "petitions bucket select" on storage.objects
  for select using (bucket_id = 'petitions' and auth.role() = 'authenticated');

drop policy if exists "petitions bucket insert" on storage.objects;
create policy "petitions bucket insert" on storage.objects
  for insert with check (
    bucket_id = 'petitions'
    and can_modify_petition(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "petitions bucket delete" on storage.objects;
create policy "petitions bucket delete" on storage.objects
  for delete using (
    bucket_id = 'petitions'
    and can_modify_petition(((storage.foldername(name))[1])::uuid)
  );
