-- Groundwork pentru restaurare: adminul poate re-insera comentarii cu autorul
-- original. Fără asta, politica cere auth.uid() = author_id, deci restaurarea
-- comentariilor altor useri ar eșua. Tasks/etichete/legături erau deja permise
-- adminului (vezi 0002/0004).
drop policy if exists "comments insert own" on comments;
create policy "comments insert own or admin" on comments
  for insert with check (auth.uid() = author_id or is_admin());
