-- Obligațiile periodice către ANP și alții.
--
-- Deosebirea față de o sarcină obișnuită e întreagă rațiunea tabelei: o sarcină
-- există doar dacă cineva își amintește s-o creeze, deci o lună uitată nu lasă
-- nimic în urmă care să tacă. Obligația există prin regulă, iar luna în care
-- n-a fost bifată se vede tocmai pentru că regula a produs un termen.
--
-- Termenele NU se stochează: se calculează din regulă. O coloană cu „următorul
-- termen" ar trebui împinsă înainte de cineva, iar ziua în care nimeni n-o
-- împinge e exact ziua în care evidența minte.

create table if not exists obligations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  recipient text not null default 'ANP',

  kind text not null check (kind in ('lunar_zi', 'lunar_ultima_zi', 'saptamanal')),
  -- Ziua din lună pentru `lunar_zi`. Se reține cum a fost scrisă în act (30),
  -- iar retezarea la lungimea lunii se face la calcul: februarie n-are 30.
  day_of_month smallint check (day_of_month between 1 and 31),
  -- 0 = duminică … 5 = vineri … 6 = sâmbătă, ca `Date.getDay()`.
  weekday smallint check (weekday between 0 and 6),

  -- Fiecare fel își cere câmpul lui și numai pe al lui: altfel o obligație
  -- săptămânală cu „ziua 30" ar trece de validare și ar tăcea despre care
  -- dintre cele două reguli se aplică.
  constraint obligations_kind_fields check (
    (kind = 'lunar_zi' and day_of_month is not null and weekday is null)
    or (kind = 'lunar_ultima_zi' and day_of_month is null and weekday is null)
    or (kind = 'saptamanal' and weekday is not null and day_of_month is null)
  ),

  assignee_id uuid references profiles(id) on delete set null,
  active boolean not null default true,
  position smallint not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bifarea unui termen anume. Cheia unică e (obligație, termen): o lună nu poate
-- fi bifată de două ori, iar bifa se leagă de termenul calculat, nu de momentul
-- apăsării — altfel n-am ști pentru care lună s-a făcut.
create table if not exists obligation_completions (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references obligations(id) on delete cascade,
  due_date date not null,
  completed_at timestamptz not null default now(),
  completed_by uuid references profiles(id) on delete set null,
  note text,
  unique (obligation_id, due_date)
);

create index if not exists obligation_completions_idx
  on obligation_completions (obligation_id, due_date desc);

drop trigger if exists obligations_updated_at on obligations;
create trigger obligations_updated_at before update on obligations
  for each row execute function set_updated_at();

alter table obligations enable row level security;
alter table obligation_completions enable row level security;

-- Lista o administrează adminul; bifează oricine, fiindcă obligația e a secției.
drop policy if exists "obligations select" on obligations;
create policy "obligations select" on obligations
  for select using (auth.role() = 'authenticated');

drop policy if exists "obligations write" on obligations;
create policy "obligations write" on obligations
  for all using (is_admin()) with check (is_admin());

drop policy if exists "completions select" on obligation_completions;
create policy "completions select" on obligation_completions
  for select using (auth.role() = 'authenticated');

drop policy if exists "completions insert" on obligation_completions;
create policy "completions insert" on obligation_completions
  for insert with check (auth.role() = 'authenticated');

-- Se poate scoate bifa pusă din greșeală; ștergerea lasă urmă în audit.
drop policy if exists "completions delete" on obligation_completions;
create policy "completions delete" on obligation_completions
  for delete using (auth.role() = 'authenticated');

create or replace function record_obligation_audit() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  rec record;
  det jsonb;
  aname text;
  otitle text;
begin
  if (TG_OP = 'DELETE') then rec := OLD; else rec := NEW; end if;

  if TG_TABLE_NAME = 'obligations' then
    det := jsonb_build_object('title', rec.title);
  else
    select title into otitle from obligations where id = rec.obligation_id;
    det := jsonb_build_object('title', otitle, 'due_date', rec.due_date);
  end if;

  select full_name into aname from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, TG_TABLE_NAME, rec.id, det);
  return null;
end;
$$;

drop trigger if exists audit_obligations on obligations;
create trigger audit_obligations after insert or update or delete on obligations
  for each row execute function record_obligation_audit();

drop trigger if exists audit_obligation_completions on obligation_completions;
create trigger audit_obligation_completions
  after insert or delete on obligation_completions
  for each row execute function record_obligation_audit();

-- Cele patru obligații de acum. `on conflict do nothing` pe titlu ar cere un
-- index unic pe text; în schimb se inserează doar dacă tabela e goală, ca o
-- rulare repetată a migrării să nu le dubleze.
insert into obligations (title, recipient, kind, day_of_month, weekday, position)
select * from (values
  ('Informare privind lista condamnaților care urmează a fi eliberați luna următoare, cu ZPM',
   'ANP', 'lunar_zi', 20::smallint, null::smallint, 1::smallint),
  ('Informare privind lista condamnaților la care s-a admis înaintarea demersului (art. 91, 92, 107 CP)',
   'ANP', 'lunar_zi', 30::smallint, null::smallint, 2::smallint),
  ('Darea de seamă săptămânală',
   'ANP', 'saptamanal', null::smallint, 5::smallint, 3::smallint),
  ('Darea de seamă lunară',
   'ANP', 'lunar_ultima_zi', null::smallint, null::smallint, 4::smallint)
) as seed
where not exists (select 1 from obligations);
