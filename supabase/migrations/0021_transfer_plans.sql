-- Planificarea transferurilor pentru ședințe: evidență nominală, ca nimeni să
-- nu fie scăpat din vedere.
--
-- Spre deosebire de `transfers`, care ține cifre, aici sunt persoane. Ziua de
-- transfer NU se stochează: se calculează din data ședinței, ca o amânare să
-- mute însemnarea singură. O coloană salvată ar rămâne în urmă tăcut.

create table if not exists transfer_plans (
  id uuid primary key default gen_random_uuid(),

  last_name text not null check (length(trim(last_name)) > 0),
  first_name text not null check (length(trim(first_name)) > 0),

  -- Instanța ca text, dar aleasă dintr-o listă fixă în interfață: lista de
  -- instanțe se schimbă mai des decât merită o migrare, iar un `check` ar
  -- transforma o redenumire de sediu într-o intervenție în bază.
  court text not null check (length(trim(court)) > 0),

  -- Penitenciarul unde trebuie dus omul. Aceleași excluderi ca la transferuri:
  -- nr. 6 suntem noi, nr. 14 nu există.
  institution smallint not null
    check (institution between 1 and 18 and institution not in (6, 14)),

  hearing_date date not null,

  -- Încheiat după ședință: iese din listă, dar rămâne în evidență.
  done boolean not null default false,

  note text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transfer_plans_hearing_idx
  on transfer_plans (hearing_date) where not done;

drop trigger if exists transfer_plans_updated_at on transfer_plans;
create trigger transfer_plans_updated_at before update on transfer_plans
  for each row execute function set_updated_at();

alter table transfer_plans enable row level security;

-- Ca la celelalte registre ale secției: oricine autentificat citește și
-- completează, ștergerea e a adminului, iar cine a scris rămâne în audit.
drop policy if exists "transfer_plans select" on transfer_plans;
create policy "transfer_plans select" on transfer_plans
  for select using (auth.role() = 'authenticated');

drop policy if exists "transfer_plans insert" on transfer_plans;
create policy "transfer_plans insert" on transfer_plans
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "transfer_plans update" on transfer_plans;
create policy "transfer_plans update" on transfer_plans
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "transfer_plans delete" on transfer_plans;
create policy "transfer_plans delete" on transfer_plans
  for delete using (is_admin());

-- Auditul: fiind date nominale, orice atingere trebuie să lase urmă.
create or replace function record_transfer_plan_audit() returns trigger
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
    'court', rec.court,
    'hearing_date', rec.hearing_date
  );
  if TG_OP = 'UPDATE' then
    if NEW.hearing_date is distinct from OLD.hearing_date then
      det := det || jsonb_build_object('hearing_from', OLD.hearing_date,
                                       'hearing_to', NEW.hearing_date);
    end if;
    if NEW.done is distinct from OLD.done then
      det := det || jsonb_build_object('done_to', NEW.done);
    end if;
  end if;

  select full_name into aname from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, 'transfer_plans', rec.id, det);
  return null;
end;
$$;

drop trigger if exists audit_transfer_plans on transfer_plans;
create trigger audit_transfer_plans
  after insert or update or delete on transfer_plans
  for each row execute function record_transfer_plan_audit();
