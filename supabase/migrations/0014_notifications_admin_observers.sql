-- Adminul urmărește activitatea echipei: primește copie la orice notificare,
-- plus un tip nou „created" pentru sarcinile create de altcineva.

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('assigned', 'comment', 'status', 'edited', 'deleted', 'created'));

-- Garda anti-spam accepta doar creatorul sau responsabilul sarcinii, deci
-- adminii erau filtrați. Se adaugă ca destinatari admiși; restul regulii rămâne.
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

  -- Destinatari admiși pentru o notificare legată de o sarcină: creatorul,
  -- responsabilul sau un admin (care are oricum drept de vedere pe tot).
  -- La ștergere (p_task_id null) sarcina a dispărut și nu se poate valida.
  if p_task_id is not null then
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

  insert into notifications (user_id, type, task_id, actor_id, actor_name, message)
  select r, p_type, p_task_id, v_actor, v_actor_name, p_message
  from unnest(v_valid) as r;
end;
$$;
