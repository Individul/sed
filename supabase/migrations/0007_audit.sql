-- Audit: cine / ce / când pentru modificările datelor, la nivel de DB (trigger-e,
-- nu pot fi ocolite de aplicație). Nu e retroactiv — începe de la aplicarea migrării.
-- actor_name e denormalizat (snapshot) ca afișarea să nu depindă de join și ca un
-- eșec de audit să nu poată bloca operația reală (fără FK pe actor).

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text not null,          -- INSERT | UPDATE | DELETE
  entity text not null,          -- tasks | comments | tags | task_tags | profiles
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_at_idx on audit_log (created_at desc);

alter table audit_log enable row level security;
drop policy if exists "audit select admin" on audit_log;
create policy "audit select admin" on audit_log
  for select using (is_admin());

create or replace function record_audit() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  rec record;
  eid uuid := null;
  det jsonb := '{}'::jsonb;
  aname text := null;
begin
  if (TG_OP = 'DELETE') then rec := OLD; else rec := NEW; end if;

  if TG_TABLE_NAME = 'tasks' then
    eid := rec.id;
    det := jsonb_build_object('title', rec.title, 'status', rec.status);
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

drop trigger if exists audit_tasks on tasks;
create trigger audit_tasks after insert or update or delete on tasks
  for each row execute function record_audit();

drop trigger if exists audit_comments on comments;
create trigger audit_comments after insert or update or delete on comments
  for each row execute function record_audit();

drop trigger if exists audit_tags on tags;
create trigger audit_tags after insert or update or delete on tags
  for each row execute function record_audit();

drop trigger if exists audit_task_tags on task_tags;
create trigger audit_task_tags after insert or update or delete on task_tags
  for each row execute function record_audit();

drop trigger if exists audit_profiles on profiles;
create trigger audit_profiles after insert or update or delete on profiles
  for each row execute function record_audit();
