-- Notificări și pentru petiții: legătură proprie (tabela era legată doar de
-- `tasks`) și gardă anti-spam echivalentă pe petiții.

alter table notifications
  add column if not exists petition_id uuid references petitions(id) on delete set null;

create index if not exists notifications_petition_idx on notifications (petition_id);

-- Semnătura se schimbă (parametru nou), deci vechea funcție se scoate întâi.
drop function if exists create_notifications(uuid[], text, uuid, text);

create or replace function create_notifications(
  p_recipients uuid[],
  p_type text,
  p_task_id uuid,
  p_message text,
  p_petition_id uuid default null
) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_valid uuid[];
begin
  if v_actor is null then return; end if;
  select full_name into v_actor_name from profiles where id = v_actor;

  -- Destinatari admiși: creatorul, responsabilul sau un admin (care vede tot).
  -- La ștergere ambele legături sunt null: elementul a dispărut și nu se poate
  -- valida, deci trece oricine în afară de actor — ca înainte.
  if p_petition_id is not null then
    select array_agg(r) into v_valid
    from unnest(p_recipients) as r
    where r is not null and r <> v_actor
      and (
        exists (select 1 from profiles p where p.id = r and p.role = 'admin')
        or exists (
          select 1 from petitions pt
          where pt.id = p_petition_id and (pt.created_by = r or pt.assignee_id = r)
        )
      );
  elsif p_task_id is not null then
    select array_agg(r) into v_valid
    from unnest(p_recipients) as r
    where r is not null and r <> v_actor
      and (
        exists (select 1 from profiles p where p.id = r and p.role = 'admin')
        or exists (
          select 1 from tasks t
          where t.id = p_task_id and (t.created_by = r or t.assignee_id = r)
        )
      );
  else
    select array_agg(r) into v_valid
    from unnest(p_recipients) as r
    where r is not null and r <> v_actor;
  end if;

  if v_valid is null then return; end if;

  insert into notifications (user_id, type, task_id, petition_id, actor_id, actor_name, message)
  select r, p_type, p_task_id, p_petition_id, v_actor, v_actor_name, p_message
  from unnest(v_valid) as r;
end;
$$;
