-- Evidența ședințelor de judecată: un rând pe zi, agregat pe toate
-- judecătoriile (nu per instanță — nu există dimensiune de judecătorie).
--
-- Se introduc patru cifre; cele trei totaluri sunt coloane generate, deci nu
-- pot ajunge să nu corespundă, indiferent cine scrie în tabelă.

create table if not exists hearings (
  id uuid primary key default gen_random_uuid(),
  session_date date not null unique,

  -- Teleconferință
  tc_petrecute integer not null default 0 check (tc_petrecute >= 0),
  tc_amanate integer not null default 0 check (tc_amanate >= 0),
  -- Instanța de judecată
  ij_petrecute integer not null default 0 check (ij_petrecute >= 0),
  ij_amanate integer not null default 0 check (ij_amanate >= 0),

  tc_total integer generated always as (tc_petrecute + tc_amanate) stored,
  ij_total integer generated always as (ij_petrecute + ij_amanate) stored,
  total_general integer generated always as
    (tc_petrecute + tc_amanate + ij_petrecute + ij_amanate) stored,

  note text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hearings_date_idx on hearings (session_date desc);

drop trigger if exists hearings_updated_at on hearings;
create trigger hearings_updated_at before update on hearings
  for each row execute function set_updated_at();

alter table hearings enable row level security;

-- Registru comun al secției: oricine autentificat citește și completează —
-- altfel un coleg n-ar putea corecta ziua introdusă de altul. Cine a scris
-- rămâne în jurnalul de audit. Ștergerea unei zile e doar a adminului.
drop policy if exists "hearings select" on hearings;
create policy "hearings select" on hearings
  for select using (auth.role() = 'authenticated');

drop policy if exists "hearings insert" on hearings;
create policy "hearings insert" on hearings
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "hearings update" on hearings;
create policy "hearings update" on hearings
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "hearings delete" on hearings;
create policy "hearings delete" on hearings
  for delete using (is_admin());

-- Auditul intră în jurnalul existent, nu într-unul paralel: adminul vede toate
-- modificările într-un singur loc, la /admin.
create or replace function record_audit() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  rec record;
  eid uuid := null;
  det jsonb := '{}'::jsonb;
  aname text := null;
  af text;
  atn text;
begin
  if (TG_OP = 'DELETE') then rec := OLD; else rec := NEW; end if;

  if TG_TABLE_NAME = 'tasks' then
    eid := rec.id;
    if TG_OP = 'UPDATE' then
      det := jsonb_build_object('title', NEW.title);
      if NEW.status is distinct from OLD.status then
        det := det || jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status);
      end if;
      if NEW.priority is distinct from OLD.priority then
        det := det || jsonb_build_object('priority_from', OLD.priority, 'priority_to', NEW.priority);
      end if;
      if NEW.assignee_id is distinct from OLD.assignee_id then
        select full_name into af from profiles where id = OLD.assignee_id;
        select full_name into atn from profiles where id = NEW.assignee_id;
        det := det || jsonb_build_object('assignee_from', af, 'assignee_to', atn);
      end if;
      if NEW.title is distinct from OLD.title then
        det := det || jsonb_build_object('title_from', OLD.title, 'title_to', NEW.title);
      end if;
      if NEW.due_date is distinct from OLD.due_date then
        det := det || jsonb_build_object('due_from', OLD.due_date, 'due_to', NEW.due_date);
      end if;
    else
      det := jsonb_build_object('title', rec.title, 'status', rec.status, 'priority', rec.priority);
    end if;
  elsif TG_TABLE_NAME = 'subtasks' then
    eid := rec.id;
    det := jsonb_build_object('task_id', rec.task_id, 'title', rec.title);
    if TG_OP = 'UPDATE' and (NEW.done is distinct from OLD.done) then
      det := det || jsonb_build_object('done_to', NEW.done);
    end if;
  elsif TG_TABLE_NAME = 'hearings' then
    eid := rec.id;
    -- Ziua și totalul: destul cât să se vadă în jurnal ce s-a schimbat, fără
    -- să fie nevoie de deschiderea zilei respective.
    det := jsonb_build_object('session_date', rec.session_date, 'total', rec.total_general);
    if TG_OP = 'UPDATE' and (NEW.total_general is distinct from OLD.total_general) then
      det := det || jsonb_build_object('total_from', OLD.total_general, 'total_to', NEW.total_general);
    end if;
  elsif TG_TABLE_NAME = 'comments' then
    eid := rec.id;
    det := jsonb_build_object('task_id', rec.task_id);
  elsif TG_TABLE_NAME = 'tags' then
    eid := rec.id;
    det := jsonb_build_object('name', rec.name);
  elsif TG_TABLE_NAME = 'task_tags' then
    det := jsonb_build_object('task_id', rec.task_id, 'tag_id', rec.tag_id);
  elsif TG_TABLE_NAME = 'profiles' then
    eid := rec.id;
    det := jsonb_build_object('full_name', rec.full_name, 'role', rec.role);
  end if;

  select full_name into aname from profiles where id = auth.uid();

  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, TG_TABLE_NAME, eid, det);

  return null;
end;
$$;

drop trigger if exists audit_hearings on hearings;
create trigger audit_hearings after insert or update or delete on hearings
  for each row execute function record_audit();
