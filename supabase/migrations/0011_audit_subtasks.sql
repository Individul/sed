-- Audit și pentru pași (subtasks): bifare/debifare, adăugare, ștergere.
-- Extinde record_audit cu ramura „subtasks" și task_history să includă pașii sarcinii.

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

drop trigger if exists audit_subtasks on subtasks;
create trigger audit_subtasks after insert or update or delete on subtasks
  for each row execute function record_audit();

create or replace function task_history(p_task_id uuid)
  returns setof audit_log
  language sql security definer stable
  set search_path = public
as $$
  select * from audit_log
  where (entity = 'tasks' and entity_id = p_task_id)
     or (entity = 'subtasks' and (details->>'task_id')::uuid = p_task_id)
  order by created_at asc;
$$;

grant execute on function task_history(uuid) to authenticated;
