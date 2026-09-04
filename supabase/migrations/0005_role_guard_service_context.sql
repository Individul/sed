-- Fix: gărzile de rol/reatribuire blocau și contextul de serviciu (SQL Editor /
-- service role), unde auth.uid() e null — ceea ce făcea imposibil bootstrap-ul
-- primului admin direct din SQL. Acum blochează doar userii AUTENTIFICAȚI
-- non-admin; contextul de serviciu (fără auth.uid()) e permis (e de încredere).

create or replace function prevent_role_change_by_non_admin() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception 'Doar adminul poate schimba rolul.';
  end if;
  return new;
end;
$$;

create or replace function prevent_reassign_by_non_admin() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
begin
  if new.assignee_id is distinct from old.assignee_id and auth.uid() is not null and not is_admin() then
    raise exception 'Doar adminul poate schimba responsabilul.';
  end if;
  return new;
end;
$$;
