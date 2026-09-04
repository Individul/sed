-- Petițiile nu erau auditate: schimbarea responsabilului, a termenului sau
-- ștergerea unei petiții nu lăsau nicio urmă. Într-un registru cu termen legal
-- de 27 de zile, asta e o lipsă, nu o omisiune minoră.
--
-- Se auditează și fișierele: o scanare ștearsă e o probă dispărută.

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

drop trigger if exists audit_petitions on petitions;
create trigger audit_petitions after insert or update or delete on petitions
  for each row execute function record_audit();

drop trigger if exists audit_petition_attachments on petition_attachments;
create trigger audit_petition_attachments
  after insert or update or delete on petition_attachments
  for each row execute function record_audit();
