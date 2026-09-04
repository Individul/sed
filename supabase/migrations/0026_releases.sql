-- Eliberările, ca să nu mai fie singura cifră din raportul săptămânal care se
-- ține minte. Un rând pe zi: ziua și câți. Atât — orice coloană în plus ar fi
-- un câmp de completat săptămânal, pentru o cifră pe care n-o cere nimeni.

create table if not exists releases (
  id uuid primary key default gen_random_uuid(),
  release_date date not null unique,
  count integer not null default 0 check (count >= 0),
  note text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists releases_date_idx on releases (release_date desc);

drop trigger if exists releases_updated_at on releases;
create trigger releases_updated_at before update on releases
  for each row execute function set_updated_at();

alter table releases enable row level security;

-- Registru comun al secției, ca la ședințe: oricine autentificat citește și
-- completează, altfel un coleg n-ar putea corecta ziua introdusă de altul.
-- Ștergerea e a adminului. Cine a scris rămâne în jurnal.
drop policy if exists "releases select" on releases;
create policy "releases select" on releases
  for select using (auth.role() = 'authenticated');

drop policy if exists "releases insert" on releases;
create policy "releases insert" on releases
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "releases update" on releases;
create policy "releases update" on releases
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "releases delete" on releases;
create policy "releases delete" on releases
  for delete using (is_admin());

-- Funcție proprie, nu o ramură în `record_audit()`: fiecare tabel nou și-a adus
-- a lui (0021, 0023, 0025), fiindcă rescrierea funcției comune înseamnă de
-- fiecare dată să rescrii și ramurile celorlalte module — iar una pierdută
-- acolo nu se vede, doar încetează să mai scrie în jurnal.
--
-- Cifra e toată informația din rând, deci schimbarea ei se scrie explicit: un
-- „3 → 5" în jurnal e singurul mod de a deosebi o corectură de o greșeală,
-- după ce numărul vechi a fost deja suprascris în tabelă.
create or replace function record_release_audit() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  rec record;
  det jsonb;
  aname text;
begin
  if (TG_OP = 'DELETE') then rec := OLD; else rec := NEW; end if;

  det := jsonb_build_object('release_date', rec.release_date, 'count', rec.count);
  if TG_OP = 'UPDATE' and NEW.count is distinct from OLD.count then
    det := det || jsonb_build_object('count_from', OLD.count, 'count_to', NEW.count);
  end if;

  select full_name into aname from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, 'releases', rec.id, det);
  return null;
end;
$$;

drop trigger if exists audit_releases on releases;
create trigger audit_releases after insert or update or delete on releases
  for each row execute function record_release_audit();
