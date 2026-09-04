-- Funcție ajutătoare: userul curent e admin?
create or replace function is_admin() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Constrângere de integritate pe rol (orice cale de scriere, nu doar din app)
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin', 'member'));

-- ===== tasks =====
drop policy if exists "tasks insert authenticated" on tasks;
create policy "tasks insert" on tasks
  for insert with check (
    is_admin()
    or (created_by = auth.uid() and (assignee_id = auth.uid() or assignee_id is null))
  );

-- update: adminul orice; membrul poate edita task-urile create de el sau atribuite lui.
-- Interdicția de reatribuire pentru membri e impusă de trigger-ul de mai jos (compară
-- delta assignee), nu de WITH CHECK — altfel un creator ar fi blocat după ce adminul
-- reatribuie task-ul altcuiva.
drop policy if exists "tasks update authenticated" on tasks;
create policy "tasks update" on tasks
  for update using (
    is_admin() or created_by = auth.uid() or assignee_id = auth.uid()
  ) with check (
    is_admin() or created_by = auth.uid() or assignee_id = auth.uid()
  );

drop policy if exists "tasks delete authenticated" on tasks;
create policy "tasks delete" on tasks
  for delete using (is_admin() or created_by = auth.uid());

-- membrii nu pot schimba responsabilul (nici reatribui, nici dezasigna)
create or replace function prevent_reassign_by_non_admin() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
begin
  if new.assignee_id is distinct from old.assignee_id and not is_admin() then
    raise exception 'Doar adminul poate schimba responsabilul.';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_reassign_guard on tasks;
create trigger tasks_reassign_guard before update on tasks
  for each row execute function prevent_reassign_by_non_admin();

-- ===== comments =====
drop policy if exists "comments delete own" on comments;
create policy "comments delete" on comments
  for delete using (is_admin() or auth.uid() = author_id);

-- ===== profiles =====
drop policy if exists "update own profile" on profiles;
create policy "profiles update" on profiles
  for update using (auth.uid() = id or is_admin());

-- împiedică un non-admin să-și schimbe singur rolul
create or replace function prevent_role_change_by_non_admin() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Doar adminul poate schimba rolul.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard before update on profiles
  for each row execute function prevent_role_change_by_non_admin();
