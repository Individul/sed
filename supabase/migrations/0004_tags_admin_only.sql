-- Crearea/modificarea/ștergerea etichetelor: doar adminul.
-- Citirea și atașarea pe sarcini (task_tags) rămân pentru toți userii autentificați.
drop policy if exists "tags all authenticated" on tags;

create policy "tags select authenticated" on tags
  for select using (auth.role() = 'authenticated');

create policy "tags insert admin" on tags
  for insert with check (is_admin());

create policy "tags update admin" on tags
  for update using (is_admin()) with check (is_admin());

create policy "tags delete admin" on tags
  for delete using (is_admin());
