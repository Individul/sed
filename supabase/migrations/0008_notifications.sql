create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('assigned','comment','status','edited','deleted')),
  task_id uuid references tasks(id) on delete set null,
  actor_id uuid references profiles(id) on delete set null,
  actor_name text,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on notifications (user_id, read, created_at desc);

alter table notifications enable row level security;

create policy "notifications select own" on notifications
  for select using (user_id = auth.uid());
create policy "notifications update own" on notifications
  for update using (user_id = auth.uid());
create policy "notifications delete own" on notifications
  for delete using (user_id = auth.uid());

create or replace function create_notifications(
  p_recipients uuid[],
  p_type text,
  p_task_id uuid,
  p_message text
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

  -- Anti-spam: dacă notificarea e legată de o sarcină, destinatarii admiși sunt
  -- doar creatorul sau responsabilul acelei sarcini (nu utilizatori arbitrari).
  -- La ștergere (p_task_id null) nu se poate valida sarcina (a dispărut).
  if p_task_id is not null then
    select array_agg(r) into v_valid
    from unnest(p_recipients) as r
    where r is not null and r <> v_actor
      and exists (
        select 1 from tasks t
        where t.id = p_task_id and (t.created_by = r or t.assignee_id = r)
      );
  else
    select array_agg(r) into v_valid
    from unnest(p_recipients) as r
    where r is not null and r <> v_actor;
  end if;

  if v_valid is null then return; end if;

  insert into notifications (user_id, type, task_id, actor_id, actor_name, message)
  select r, p_type, p_task_id, v_actor, v_actor_name, p_message
  from unnest(v_valid) as r;
end;
$$;

alter publication supabase_realtime add table notifications;
