# Supabase setup (task-manager)

This app uses a hosted Supabase project for auth + Postgres. Follow these steps
once to provision the backend for the Vercel-native task manager.

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once it is ready, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Put these in `.env.local` (local dev) and in the Vercel project environment
   variables (deployment). See `.env.example` for the variable names.

## 2. Run the schema migration

1. Open the **SQL Editor** in the Supabase dashboard.
2. Paste the full contents of [`migrations/0001_init.sql`](./migrations/0001_init.sql)
   and run it.
3. Verify in **Table Editor** that these tables exist: `profiles`, `tasks`,
   `tags`, `task_tags`, `comments`.

## 2b. Roluri

Autorizarea pe roluri (`admin` / `member`) e definită în
[`migrations/0002_roles.sql`](./migrations/0002_roles.sql).

1. În **SQL Editor**, rulează `migrations/0002_roles.sql` **DUPĂ**
   `0001_init.sql`, apoi `migrations/0005_role_guard_service_context.sql`.
   `0002` adaugă coloana `role`, politicile RLS și trigger-ul `profiles_role_guard`
   (doar un admin poate schimba roluri); `0005` corectează gărzile ca să blocheze
   doar userii **autentificați** non-admin — altfel trigger-ul blochează chiar și
   bootstrap-ul din SQL Editor (unde `auth.uid()` e null).
2. **Bootstrap primul admin.** Deoarece încă nu există niciun admin care să
   promoveze pe cineva din UI, setează manual primul administrator (merge direct
   după ce ai aplicat `0005`):

   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'emailul-tău');
   ```

   > Dacă nu ai aplicat `0005`, dezactivează temporar trigger-ul în jurul update-ului:
   > `alter table profiles disable trigger profiles_role_guard;` … update … apoi
   > `alter table profiles enable trigger profiles_role_guard;`

3. După bootstrap, promovările/retrogradările ulterioare se fac în aplicație la
   [`/admin`](../README.md#roluri) — nu mai e nevoie de SQL manual.

## 2c. Username

Pentru a permite login cu **username** (pe lângă email), rulează
[`migrations/0003_username.sql`](./migrations/0003_username.sql) **DUPĂ**
`0002_roles.sql`. Adaugă coloana `username` (unică, case-insensitive) și funcția
`email_for_login`, care rezolvă username→email la autentificare (apelabilă de rolul
`anon`, fiindcă login-ul se face neautentificat).

Userii își setează singuri username-ul din aplicație („Profilul meu"). Login-ul
acceptă email **sau** username + parolă.

## 2d. Etichete (creare doar de admin)

Rulează [`migrations/0004_tags_admin_only.sql`](./migrations/0004_tags_admin_only.sql)
**DUPĂ** `0002_roles.sql`. Doar adminul poate crea/modifica/șterge etichete; toți
utilizatorii le pot citi și atașa pe sarcini.

## 2e. Restaurare backup (opțional)

Pentru ca adminul să poată **restaura** dintr-un backup din aplicație (adaugă
înregistrările lipsă, non-distructiv — vezi `/admin`), rulează
[`migrations/0006_restore_comments.sql`](./migrations/0006_restore_comments.sql).
Relaxează politica de inserare a comentariilor ca adminul să le poată re-insera cu
autorul original. Tasks/etichete/legături erau deja permise adminului (`0002`/`0004`).

## 2f. Creare utilizatori din aplicație (opțional)

Pentru butonul **„Adaugă utilizator"** din `/admin` (creează cont cu username +
parolă, fără email real), adaugă cheia **service-role**:

1. Supabase → **Project Settings → API** → copiază **service_role** (secret!).
2. Pune-o în `apps/task-manager/.env.local` și în variabilele de mediu Vercel:
   ```
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   Este **doar pe server** (fără `NEXT_PUBLIC_`) — nu o expune niciodată în client.

Contul se creează cu un email intern `username@intern.local` (userul se loghează
doar cu username + parolă). Fără această cheie, butonul întoarce o eroare clară.

## 2g. Audit (opțional)

Pentru secțiunea **Audit** din `/admin` (cine/ce/când), rulează
[`migrations/0007_audit.sql`](./migrations/0007_audit.sql). Creează tabela
`audit_log` + trigger-e pe tasks/comments/tags/task_tags/profiles care
înregistrează modificările (nu e retroactiv — începe după aplicare). Citirea e
permisă doar adminului.

## 2h. Notificări (opțional)

Pentru notificările în aplicație (clopoțelul cu sarcini atribuite, comentarii,
schimbări de stare etc.), rulează
[`migrations/0008_notifications.sql`](./migrations/0008_notifications.sql)
**DUPĂ** `0007_audit.sql`. Creează tabela `notifications` cu RLS (fiecare user
își vede/actualizează/șterge doar propriile notificări), funcția `create_notifications`
și **activează Realtime** pe tabelă (o adaugă la publicația `supabase_realtime`),
ca clopoțelul să se actualizeze live.

## 2i. Atașamente la petiții (opțional)

Pentru scanările atașate petițiilor (cererea și răspunsul), rulează
[`migrations/0013_petition_attachments.sql`](./migrations/0013_petition_attachments.sql)
**DUPĂ** `0012_petitions.sql`. Migrarea:

1. creează bucket-ul **privat** `petitions` (PDF/JPG/PNG, max 10 MB per fișier);
2. creează tabela `petition_attachments` (un rând per fișier, cu `kind` =
   `petitie` sau `raspuns`), legată de petiție cu `on delete cascade`;
3. adaugă funcția `can_modify_petition` și politicile RLS pe tabelă și pe
   `storage.objects` — citesc toți utilizatorii autentificați, dar încarcă/șterg
   doar cei care pot modifica petiția (admin / creator / responsabil, aceeași
   regulă ca politica `petitions update`).

> Bucket-ul trebuie să rămână **privat**. Fișierele se deschid prin URL-uri
> semnate, generate la cerere — dacă bucket-ul devine public, orice scanare
> devine accesibilă oricui are link-ul.

## 2j. Statistici (opțional)

Pentru importul fișierelor de raportare (xlsx) și indicatorii extrași din ele,
rulează [`migrations/0016_statistics.sql`](./migrations/0016_statistics.sql)
**DUPĂ** `0015_petition_notifications.sql`. Migrarea:

1. creează bucket-ul **privat** `statistics` (xlsx, max 10 MB per fișier);
2. creează tabela `stat_reports` (un rând per raport: `kind`, `period_date`,
   `period_type` — unice împreună — plus fișierul-sursă încărcat);
3. creează tabela `stat_values` (valorile extrase, legate de raport cu
   `on delete cascade`);
4. adaugă politicile RLS pe cele două tabele și pe `storage.objects`: **citesc**
   toți utilizatorii autentificați, dar **scriu** (încarcă/modifică/șterg) doar
   adminii — sunt date de raportare instituțională.

> Bucket-ul trebuie să rămână **privat**. Fișierele se deschid prin URL-uri
> semnate, generate la cerere.

## 3. Make the workspace invite-only (email + password)

1. Go to **Authentication → Providers → Email**.
2. Make sure the **Email** provider is **enabled** (password sign-in is on by default).
3. Turn **OFF** "Enable email signups" so only users you add manually can log in.
   Signing IN existing users with a password still works with signups off.

## 4. Add the team members (with passwords)

1. Go to **Authentication → Users → Add user**.
2. Add the 4-5 team members by email, **set a password for each**, and enable
   **"Auto Confirm User"** so they can sign in immediately.
3. Optionally set each user's `full_name` (and `avatar_url`) in **User metadata** —
   the `handle_new_user` trigger copies it into their `profiles` row on first sign-in.
4. Users can change their own password later from the app ("Schimbă parola" in the
   top-right of the tasks page).

## 5. Redirect URLs (optional)

Email + password login does **not** require redirect URLs. If you later add a
password-reset or magic-link flow (which go through `/auth/callback`), configure
**Authentication → URL Configuration → Redirect URLs**:

- Local dev: `http://localhost:3006/auth/callback`
- Production: `https://<app>.vercel.app/auth/callback`
