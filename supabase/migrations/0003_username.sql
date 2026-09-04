-- Username opțional pentru login (email SAU username).
-- Supabase Auth se loghează pe email; username-ul se rezolvă la email printr-o
-- funcție SECURITY DEFINER (email_for_login), apelabilă înainte de autentificare.

alter table profiles add column if not exists username text;

-- Unicitate case-insensitive; permite NULL pentru userii fără username.
create unique index if not exists profiles_username_lower_idx
  on profiles (lower(username))
  where username is not null;

-- Rezolvă un username la emailul contului. SECURITY DEFINER ca să poată citi
-- auth.users; apelabilă de rolul anon (login-ul se face neautentificat).
create or replace function email_for_login(identifier text)
  returns text
  language sql
  security definer
  stable
  set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(identifier)
  limit 1;
$$;

grant execute on function email_for_login(text) to anon, authenticated;
