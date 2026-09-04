-- Evidența inculpaților cu tip de penitenciar stabilit.
--
-- Nimeni nu iese din tabelă. Cine devine condamnat își schimbă starea și iese
-- din lista de lucru, dar rămâne numărabil: altfel n-am mai putea răspunde
-- niciodată câți inculpați erau în martie sau câți au trecut luna asta —
-- întrebări la care ștergerea nu lasă cale de întoarcere, iar auditul spune
-- doar că cineva a șters un rând, nu câți oameni erau.

create table if not exists defendants (
  id uuid primary key default gen_random_uuid(),

  last_name text not null check (length(trim(last_name)) > 0),
  first_name text not null check (length(trim(first_name)) > 0),

  -- Tipul stabilit de instanță. Nu se schimbă odată stabilit, deci nu are
  -- nevoie de istoric — doar de valoarea lui și de data stabilirii.
  regime text not null check (regime in ('inchis', 'semiinchis')),
  established_on date not null,

  -- Instanța din aceeași listă ca la planificarea transferurilor, ca aceeași
  -- judecătorie să se numească la fel în ambele evidențe.
  court text,
  case_number text,

  status text not null default 'inculpat' check (status in ('inculpat', 'condamnat')),
  convicted_on date,

  -- Data trecerii și starea nu pot să se contrazică: un condamnat fără dată n-ar
  -- putea fi numărat pe luni, iar un inculpat cu dată ar fi o stare imposibilă
  -- scrisă în registru.
  constraint defendants_status_date check (
    (status = 'inculpat' and convicted_on is null)
    or (status = 'condamnat' and convicted_on is not null)
  ),

  note text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists defendants_status_idx on defendants (status, last_name);

drop trigger if exists defendants_updated_at on defendants;
create trigger defendants_updated_at before update on defendants
  for each row execute function set_updated_at();

alter table defendants enable row level security;

-- Ca la celelalte registre ale secției: oricine autentificat citește și
-- completează; ștergerea e a adminului, iar cine a scris rămâne în audit.
drop policy if exists "defendants select" on defendants;
create policy "defendants select" on defendants
  for select using (auth.role() = 'authenticated');

drop policy if exists "defendants insert" on defendants;
create policy "defendants insert" on defendants
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "defendants update" on defendants;
create policy "defendants update" on defendants
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "defendants delete" on defendants;
create policy "defendants delete" on defendants
  for delete using (is_admin());

-- Date nominale: orice atingere lasă urmă.
create or replace function record_defendant_audit() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  rec record;
  det jsonb;
  aname text;
begin
  if (TG_OP = 'DELETE') then rec := OLD; else rec := NEW; end if;

  det := jsonb_build_object(
    'name', rec.last_name || ' ' || rec.first_name,
    'regime', rec.regime,
    'status', rec.status
  );
  if TG_OP = 'UPDATE' then
    if NEW.status is distinct from OLD.status then
      det := det || jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status);
    end if;
    -- Tipul nu se schimbă prin regulă, deci o schimbare a lui e cu atât mai
    -- important de scris: e fie o corectare, fie o greșeală.
    if NEW.regime is distinct from OLD.regime then
      det := det || jsonb_build_object('regime_from', OLD.regime, 'regime_to', NEW.regime);
    end if;
  end if;

  select full_name into aname from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, 'defendants', rec.id, det);
  return null;
end;
$$;

drop trigger if exists audit_defendants on defendants;
create trigger audit_defendants after insert or update or delete on defendants
  for each row execute function record_defendant_audit();
