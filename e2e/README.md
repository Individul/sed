# Teste E2E (Playwright)

Testul `tasks.spec.ts` acoperă fluxul happy-path: deschide `/tasks`, creează un
task nou, îl deschide și adaugă un comentariu.

Testul rulează contra aplicației reale — are nevoie de Supabase live **și** de o
sesiune autentificată salvată. Login-ul e prin magic link (fără parolă), deci
sesiunea se capturează o singură dată și se refolosește.

## Pași

1. **Env Supabase.** În `apps/task-manager/.env.local` pune `NEXT_PUBLIC_SUPABASE_URL`
   și `NEXT_PUBLIC_SUPABASE_ANON_KEY` reale (din Supabase → Project Settings → API).

2. **Instalează browserul Playwright** (o singură dată):
   ```bash
   npx playwright install chromium
   ```

3. **Capturează o sesiune autentificată** în `e2e/.auth/user.json`. Două variante:

   - **Manual (recomandat):**
     ```bash
     npx playwright codegen http://localhost:3006 --save-storage=e2e/.auth/user.json
     ```
     Pornește întâi dev server-ul (`npm run dev`), autentifică-te în fereastra
     deschisă (email → click pe magic link), apoi închide fereastra. Sesiunea e
     salvată în `e2e/.auth/user.json`.

   - **Programatic (CI, avansat):** folosește Supabase Admin API (cu service-role
     key, ținut în afara repo-ului) pentru a genera o sesiune pentru un user de
     test și scrie cookie-urile în `e2e/.auth/user.json`. Necesită clientul admin
     `@supabase/supabase-js`. De folosit doar în CI.

4. **Rulează testele:**
   ```bash
   npm run test:e2e
   ```

## Note

- `e2e/.auth/` este în `.gitignore` — nu comite niciodată sesiuni/token-uri.
- Pentru a doar *lista* testele fără a le rula (nu are nevoie de browser sau sesiune):
  ```bash
  npx playwright test --list
  ```
