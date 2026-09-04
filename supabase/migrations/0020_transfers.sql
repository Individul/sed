-- Evidența transferurilor: un rând per zi + penitenciar + tip, cu plecările și
-- sosirile în același rând. Se înregistrează cifre, nu persoane — vezi designul
-- pentru consecința asta (din totaluri nu se poate reveni la nume).

create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_date date not null,

  -- Numărul penitenciarului partener, nu text liber: nimeni nu poate scrie
  -- „Penit. 3" într-o zi și „P-3" în alta. Eticheta se compune în cod.
  -- Excluderile spun două lucruri deodată: nr. 6 suntem noi (nu te transferi
  -- la tine însuți), iar nr. 14 nu există.
  institution smallint not null
    check (institution between 1 and 18 and institution not in (6, 14)),

  kind text not null default 'planificat' check (kind in ('planificat', 'urgent')),

  plecati integer not null default 0 check (plecati >= 0),
  sositi integer not null default 0 check (sositi >= 0),
  total integer generated always as (plecati + sositi) stored,

  note text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- `kind` intră în cheie: într-o zi programată poate apărea și o mișcare
  -- urgentă cu aceeași instituție, iar cele două rămân rânduri distincte.
  unique (transfer_date, institution, kind)
);

create index if not exists transfers_date_idx on transfers (transfer_date desc);

drop trigger if exists transfers_updated_at on transfers;
create trigger transfers_updated_at before update on transfers
  for each row execute function set_updated_at();

alter table transfers enable row level security;

-- Registru comun al secției, ca la ședințe: oricine autentificat citește și
-- completează — altfel un coleg n-ar putea corecta ziua introdusă de altul.
-- Ștergerea e doar a adminului. Cine a scris rămâne în jurnalul de audit.
drop policy if exists "transfers select" on transfers;
create policy "transfers select" on transfers
  for select using (auth.role() = 'authenticated');

drop policy if exists "transfers insert" on transfers;
create policy "transfers insert" on transfers
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "transfers update" on transfers;
create policy "transfers update" on transfers
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "transfers delete" on transfers;
create policy "transfers delete" on transfers
  for delete using (is_admin());

-- Funcția de audit e una singură pentru toate tabelele, deci se rescrie
-- întreagă la fiecare modul nou: ramurile existente se păstrează neatinse,
-- se adaugă doar cea pentru transferuri.
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
  pnum text;
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
  elsif TG_TABLE_NAME = 'petitions' then
    eid := rec.id;
    det := jsonb_build_object('number', rec.number, 'petitioner', rec.petitioner);
    if TG_OP = 'UPDATE' then
      if NEW.status is distinct from OLD.status then
        det := det || jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status);
      end if;
      if NEW.assignee_id is distinct from OLD.assignee_id then
        select full_name into af from profiles where id = OLD.assignee_id;
        select full_name into atn from profiles where id = NEW.assignee_id;
        det := det || jsonb_build_object('assignee_from', af, 'assignee_to', atn);
      end if;
      -- Data înregistrării mută termenul legal, deci orice schimbare a ei
      -- trebuie să rămână scrisă.
      if NEW.received_date is distinct from OLD.received_date then
        det := det || jsonb_build_object('received_from', OLD.received_date,
                                         'received_to', NEW.received_date);
      end if;
      if NEW.number is distinct from OLD.number then
        det := det || jsonb_build_object('number_from', OLD.number, 'number_to', NEW.number);
      end if;
    end if;
  elsif TG_TABLE_NAME = 'petition_attachments' then
    eid := rec.id;
    -- Numărul petiției se copiază aici: rândul de audit trebuie să se
    -- înțeleagă singur, chiar dacă petiția dispare ulterior.
    select number into pnum from petitions where id = rec.petition_id;
    det := jsonb_build_object('number', pnum, 'name', rec.name);
  elsif TG_TABLE_NAME = 'hearings' then
    eid := rec.id;
    det := jsonb_build_object('session_date', rec.session_date, 'total', rec.total_general);
    if TG_OP = 'UPDATE' and (NEW.total_general is distinct from OLD.total_general) then
      det := det || jsonb_build_object('total_from', OLD.total_general, 'total_to', NEW.total_general);
    end if;
  elsif TG_TABLE_NAME = 'transfers' then
    eid := rec.id;
    -- Ziua, instituția și cele două cifre: destul cât să se vadă în jurnal ce
    -- s-a schimbat fără deschiderea rândului.
    det := jsonb_build_object(
      'transfer_date', rec.transfer_date,
      'institution', rec.institution,
      'plecati', rec.plecati,
      'sositi', rec.sositi
    );
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

drop trigger if exists audit_transfers on transfers;
create trigger audit_transfers after insert or update or delete on transfers
  for each row execute function record_audit();
