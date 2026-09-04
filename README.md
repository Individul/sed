# Task Manager

Task manager de echipă (4-5 persoane), **100% Vercel-native**: Next.js + Supabase,
fără backend separat. Găzduire GitHub + Vercel.

## Funcționalități

- Listă/tabel de task-uri cu sortare și filtrare (după stare, prioritate, responsabil)
- Atribuire către membrii echipei
- Termene (due date) și prioritate (scăzută/medie/ridicată)
- Statusuri: De făcut / În lucru / Finalizat
- Etichete colorate (create doar de admin; utilizatorii le pot alege)
- Comentarii pe fiecare task (editare/ștergere doar de autor)
- Notificări în aplicație (clopoțel) cu actualizare în timp real
- Autentificare cu **email sau username + parolă**, **invite-only** (utilizatori adăugați manual în Supabase)
- Fiecare utilizator își poate seta numele afișat și username-ul („Profilul meu") și schimba parola din aplicație

## Navigare

Pagina de start (`/`) e un **hub**, cu câte un card pentru **Sarcini**,
**Petiții** și **Transferuri** — și cifre live: total, active (respectiv în
examinare), scadente în 7 zile și restante; la transferuri, care n-au
responsabil, plecați / sosiți / sold pe luna curentă. După autentificare
aterizezi tot pe `/`.

Toate paginile autentificate au un **antet comun**: link „Acasă", tab-urile
**Sarcini | Petiții | Ședințe | Transferuri | Statistici**, clopoțelul de
notificări și acțiunile de cont
(„Profilul meu", „Schimbă parola", „Deconectare"; adminii au în plus „Administrare"). Tabul
**Sarcini** rămâne activ și pe detaliul unei sarcini (`/tasks/[id]`). Detaliul
sarcinii și pagina de administrare au, sub antet, și un buton „Înapoi la
sarcini" (→ `/sarcini`).

| Rută          | Conținut                                 |
| ------------- | ---------------------------------------- |
| `/`           | hub — carduri de modul cu cifre live     |
| `/sarcini`    | lista de sarcini                         |
| `/petitii`    | registrul petițiilor                     |
| `/sedinte`    | evidența ședințelor de judecată          |
| `/transferuri`| registrul transferurilor                 |
| `/statistici` | rapoarte statistice importate din Excel  |
| `/tasks/[id]` | detaliul unei sarcini                    |
| `/admin`      | administrare (doar admin)                |

`/tasks` redirecționează la `/sarcini`, pentru linkuri și bookmark-uri vechi.

## Stack

- **Next.js 14.1** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui** (Radix)
- **TanStack Table** (tabelul principal)
- **Supabase** — Postgres + Auth, via `@supabase/ssr`
- **react-hook-form** + **zod** (formulare)
- **Vitest** (unit) + **Playwright** (E2E)

Autorizarea e impusă de baza de date prin Row-Level Security (RLS). Mutațiile se
fac prin Server Actions; citirile prin Server Components.

## Roluri

Există două roluri: **membru** (`member`) și **administrator** (`admin`).
Autorizarea e impusă de RLS + trigger-e în Postgres (vezi
[`supabase/migrations/0002_roles.sql`](supabase/migrations/0002_roles.sql)).

| Acțiune                        | Membru                          | Administrator            |
| ------------------------------ | ------------------------------- | ------------------------ |
| Creare task                    | doar pentru sine (auto-atribuit)| pentru oricine           |
| Reatribuire task (assignee)    | nu                              | da                       |
| Editare task                   | task-uri proprii                | orice task               |
| Ștergere task                  | doar task-uri proprii           | orice task               |
| Editare comentariu             | doar autorul                    | doar autorul             |
| Ștergere comentariu            | doar autorul                    | autorul **sau** admin    |
| Gestionare roluri (`/admin`)   | nu                              | da                       |

Administratorii au acces la pagina **[`/admin`](src/app/admin/page.tsx)** unde pot
promova/retrograda utilizatori între `member` și `admin` (nu-și pot schimba
propriul rol, ca să nu se retrogradeze accidental).

> Migrarea `supabase/migrations/0002_roles.sql` trebuie aplicată (după
> `0001_init.sql`) și primul admin setat manual — vezi
> [`supabase/README.md`](supabase/README.md#2b-roluri) pentru bootstrap.

> Pentru login cu username, aplică și `supabase/migrations/0003_username.sql`
> (după `0002_roles.sql`) — vezi [`supabase/README.md`](supabase/README.md#2c-username).

## Notificări

Fiecare utilizator are un **clopoțel** (dreapta-sus, în antetul comun) cu
notificările proprii și un contor de necitite. Deschis, afișează ultimele
notificări; la click pe una o marchează citită și navighează la task, iar
„Marchează toate citite" le marchează pe toate deodată.

Notificările se generează automat la:

- **atribuire** — un task ți-a fost atribuit;
- **comentariu** — comentariu nou pe un task;
- **stare** — s-a schimbat statusul unui task;
- **editare** — un task a fost modificat;
- **ștergere** — un task a fost șters.

Destinatari: **responsabilul** (assignee) și **creatorul** task-ului, mai puțin
autorul acțiunii (nu ești notificat pentru propriile acțiuni). La atribuire e
notificat doar noul responsabil.

Livrarea e **în timp real** prin Supabase Realtime (canal `postgres_changes` pe
tabelul `notifications`, filtrat pe `user_id`), deci clopoțelul se actualizează
fără reîncărcarea paginii.

> Migrarea [`supabase/migrations/0008_notifications.sql`](supabase/migrations/0008_notifications.sql)
> trebuie aplicată (după `0007_audit.sql`); ea adaugă și tabelul `notifications`
> la publicația `supabase_realtime`.

## Transferuri

Evidența transferurilor de deținuți între penitenciare. Un rând e **o zi + un
penitenciar + planificat/urgent** și ține ambele sensuri deodată: `plecati` (din
P-6 într-acolo) și `sositi` (de acolo la P-6). `total` e **coloană generată** în
Postgres, deci nu poate ajunge să nu corespundă cu cele două cifre din care iese,
indiferent cine scrie în tabelă.

Se înregistrează **cifre, nu nume**. Nu există rând per deținut, iar consecința
merită spusă pe față: **din totaluri nu se poate reveni la persoane.** „Unde a
fost transferat X" e o întrebare la care modulul acesta nu va răspunde niciodată,
nici măcar retroactiv — ar trebui pornit un registru nominal de la zero, iar
trecutul rămâne agregat. În schimb, niciun nume de deținut nu ajunge în baza de
date.

**Penitenciarul partener e un număr, nu text liber** — eticheta („Penitenciarul
nr. 3") se compune în cod, deci nimeni nu scrie „Penit. 3" într-o zi și „P-3" în
alta, iar sortarea e naturală. Constrângerea din bază
(`institution between 1 and 18 and institution not in (6, 14)`) spune două lucruri
deodată: **nr. 6 suntem noi**, deci nu te transferi la tine însuți, iar **nr. 14
nu există**. Rămân 16 instituții.

Transferurile sunt programate în **prima și a treia zi de luni** din lună.
Aplicația le calculează singură, prin funcții pure — nu există un calendar de
întreținut. Din același calcul ies toate cele trei comportamente: tipul
„planificat" propus în formular când ziua aleasă e o luni programată, data
următorului transfer, și semnalarea unei zile programate rămase necompletate.
Golul e informația care nu se vede altundeva: o zi necompletată n-ar apărea
nicăieri în registru.

Ziua lipsă se semnalează însă **abia după ce s-a încheiat**, nu în timp ce se
desfășoară: pe 6 iulie la ora 9 transferul de pe 6 iulie e încă în curs, iar o
avertizare atunci ar fi o alarmă falsă. Semnalate degeaba, avertizările ajung
ignorate și în zilele când chiar lipsește ceva.

Pagina (`/transferuri`) are, pentru perioada aleasă: **trei cifre** — plecați,
sosiți, sold (sosiți − plecați) —, avertizarea de mai sus cu data următorului
transfer, și **registrul pe zile** în ordine inversă, cu un antet per zi și câte
un rând per penitenciar dedesubt.

Câteva alegeri de citit în pagină:

- Plecările și sosirile se disting prin **săgeți care diferă ca direcție, nu doar
  ca culoare** (↑ plecați, ↓ sosiți): cine nu distinge roșul de verde citește
  corect după formă.
- Unde nu s-a mișcat nimeni se scrie **„—", nu 0** — lipsa mișcării și mișcarea
  de zero valori sunt lucruri diferite. Soldul face excepție: pe o perioadă cu
  rânduri, 0 înseamnă „au venit câți au plecat".
- Un rând cu 0 și 0 rămâne valid. Pe o zi programată în care n-a mișcat nimeni e
  singurul fel de a spune că ziua a avut loc — altfel ar fi raportată ca lipsă.

Drepturile sunt ca la ședințe, din același motiv: oricine autentificat citește și
completează, altfel un coleg n-ar putea corecta ziua introdusă de altul.
Ștergerea unui rând e doar a adminului (impusă prin RLS, nu doar în interfață).
Cine a scris rămâne în jurnalul de audit de la `/admin`, sub modulul
**Transferuri**.

> Migrarea [`supabase/migrations/0020_transfers.sql`](supabase/migrations/0020_transfers.sql)
> trebuie aplicată (după `0019`) — până atunci modulul nu funcționează. Creează
> tabelul `transfers` cu RLS și adaugă ramura de transferuri în trigger-ul de
> audit.

## Statistici

Rapoartele statistice se completează în continuare în Excel, ca până acum.
Aplicația le **importă**, păstrează **istoricul** și arată **evoluția în timp**.
Se extrag doar datele penitenciarului **P-6**.

Pagina are **o secțiune per raport**, fiecare cu graficele potrivite conținutului
lui — forma urmează întrebarea, nu invers:

| Raport | Întrebarea | Formă |
| --- | --- | --- |
| Populație | cum evoluează numărul de deținuți? | linie, cu plafonul ca reper punctat |
| Liberări | din ce se compune totalul? | inel (sau bare, peste 6 motive) + linie în timp |
| Comisia | art. 91 față de art. 92 | bare grupate |
| Grațiere | ce s-a întâmplat cu demersurile? | bare |
| Ședințe | teleconferință față de instanță | bare grupate |
| Mecanism compensatoriu | cum evoluează? | două linii separate (persoane / termen) |
| Amnistii | structura pe articole | bare orizontale |

Fiecare secțiune are dedesubt **„Toate valorile"** — un tabel pliabil cu tot ce
s-a importat pentru perioadă. Prezentarea aleasă nu ascunde niciodată date.

Reguli de afișare care merită știute:

- Indicatorii care sunt **0 în toate perioadele** nu apar în grafice (rapoartele
  au zeci de rânduri care nu s-au întâmplat niciodată); rămân în „Toate valorile".
- O valoare lipsă **rămâne lipsă** — linia se întrerupe, nu se completează cu 0.
- Totalurile nu apar niciodată într-un grafic de compoziție, ca să nu stea totalul
  ca felie lângă propriile lui părți.
- „Suprapopularea" negativă se citește ca **locuri libere** (−5 → „Locuri libere 5").

Tipuri de raport recunoscute (detectate automat din conținut):

| Tip | Conținut |
| --- | --- |
| Raport lunar | plafon de detenție, deținuți, suprapopulare, femei, minori, liberați |
| Liberări | liberări pe motive, decedați |
| Comisia penitenciară | art. 91 / 92 CP — examinați, admiși, refuzați, expediați în judecată |
| Grațiere | demersuri, examinați, grațiați, refuzați |
| Amnistia 2016 / Amnistia 2021 | aplicarea legilor de amnistie |
| Mecanism compensatoriu | reduceri de termen (art. 473/2 CPP) |
| Ședințe de judecată | teleconferință, sediu, instanță, amânate |

**Fluxul de import** (doar admin): alegi fișierul `.xlsx` → aplicația detectează
tipul și propune perioada din numele fișierului → **previzualizezi** toți
indicatorii extrași → confirmi perioada (dată + săptămânal/lunar) → se salvează.
Fișierul original rămâne într-un bucket privat și se poate redeschide oricând.

Câteva alegeri deliberate:

- **Perioada se confirmă manual.** Datele din fișiere sunt contradictorii (un
  fișier are „30.06.2023" în titlu și 31.03.2024 în celula alăturată), deci
  ghicirea ar produce un istoric fals fără ca cineva să observe.
- **Tipul detectat poate fi schimbat.** Dacă alegi alt tip, fișierul e recitit cu
  el, așa că previzualizarea arată mereu exact ce se va salva.
- **Reimportul aceleiași perioade înlocuiește** datele, nu le dublează.
- Rapoartele cu **sub-rând de perioadă** (comisia, mecanism compensatoriu) se
  salvează pe două serii: `cumulat` și `perioada`.
- Localizarea coloanei/rândului P-6 se face **după text**, nu după coordonate, ca
  o inserare de rând în Excel să nu strice importul. Un fișier nerecunoscut dă
  eroare explicită, nu import tăcut greșit.

Vizualizarea e pentru toți utilizatorii; importul și ștergerea, doar pentru admini
(impus prin RLS, nu doar în interfață).

> Migrarea [`supabase/migrations/0016_statistics.sql`](supabase/migrations/0016_statistics.sql)
> trebuie aplicată (după `0015`); ea creează bucket-ul privat `statistics` și
> tabelele `stat_reports` / `stat_values`.

## Raportul săptămânal

În fiecare marți dimineața se informează conducerea despre săptămâna încheiată.
Patru cifre, atât: **plecați, sosiți, teleconferințe, eliberați**. Se adunau de
mână din trei locuri, iar a patra nu exista nicăieri în aplicație. Pagina
[`/raport-saptamanal`](src/app/raport-saptamanal/page.tsx) le adună singură, le
arată în forma în care se predau și le scoate din aplicație în două feluri:
**„Descarcă PDF"** (fișier `raport-AAAA-LL-ZZ.pdf`, desenat pe server) sau
**„Tipărește"** (dialogul browserului, cu antetul aplicației și zonele de
completare scoase din pagină).

Se intră din butonul **„Raportul de marți"**, de lângă salutul de pe pagina de
start. Nu are tab în antet, dinadins: nu e un registru în care se lucrează, ci
hârtia unei singure dimineți. Nu se trimite pe email și nu se generează
programat — raportul se prezintă, nu se expediază, iar o rulare automată ar
produce fișiere pe care nu le citește nimeni.

### Săptămâna e marți → luni, nu luni → duminică

**Marțea în care se prezintă raportul aparține săptămânii următoare**, nu celei
raportate. Regula pare arbitrară până se scrie alternativa: cu marțea inclusă,
aceeași zi ar intra în două rapoarte consecutive, iar un transfer de marți s-ar
număra de două ori. În plus, dimineața raportului ar depinde de date care abia
se întâmplă — ședințele zilei nu sunt introduse la ora 9.

Deschisă în orice zi, pagina arată aceeași ultimă săptămână încheiată; nici luni
nu trece la săptămâna în curs, fiindcă ziua curentă nu s-a terminat. Înapoi se
poate naviga oricât; înainte de săptămâna curentă, nu — acolo n-ar fi un raport,
ci șapte zile care încă nu s-au întâmplat, adică patru zerouri pe care nici
avertizarea de zile lipsă nu le-ar semnala, fiindcă o zi viitoare nu poate
„lipsi".

Calculul stă în [`src/lib/weekly-report.ts`](src/lib/weekly-report.ts), verificat
pe fiecare zi a unei luni întregi — regula „ziua curentă nu s-a încheiat" e ușor
de stricat la o rescriere —, și e citit deopotrivă de pagină și de ruta de PDF.
Două normalizări scrise separat s-ar despărți la prima corectură, iar
despărțirea n-ar arăta a defect: butonul de descărcare ar întoarce liniștit un
raport pe altă săptămână decât cea de pe ecran, cu cifre perfect corecte pentru
intervalul greșit. Tot prin funcția aceea (`readWeek`) trece și adresa
`?saptamana=`: dacă parametrul apare de mai multe ori se ia prima valoare, la
fel în ambele locuri, iar o zi care nu există — „2026-02-30", pe care șablonul
AAAA-LL-ZZ nu are cum s-o prindă — se respinge, în loc să fie rostogolită tăcut
de motorul JavaScript în luna următoare.

**„Azi" înseamnă ziua de la Chișinău, nu ziua de pe ceasul serverului.** Funcția
de pe Vercel merge pe UTC, iar noi suntem înaintea lui cu două ore iarna și cu
trei vara: între miezul nopții de aici și cel de la Greenwich serverul e încă în
ziua de ieri. Deschis marți la ora 2 dimineața, raportul arăta săptămâna
dinainte — patru cifre perfect corecte pentru intervalul greșit, sub un subsol
datat cu ziua de azi. Ziua calendaristică se ia acum cu `todayInChisinau()` din
[`src/lib/periods.ts`](src/lib/periods.ts), prin `Intl` și nu adunând un decalaj
fix, fiindcă Moldova ține ora de vară. Testele rulează pe UTC
([`vitest.config.ts`](vitest.config.ts)) tocmai ca greșeala asta să poată cădea:
mașinile de dezvoltare stau pe Europe/Bucharest, care are exact același decalaj
ca Chișinăul tot anul, deci local ziua citită greșit coincide cu cea corectă.

### De unde vin cele patru cifre

| Cifra | Sursa |
| --- | --- |
| Plecați / Sosiți | registrul de transferuri, zilele din interval |
| Teleconferințe | `hearings.tc_total`, cu amânatele scrise mic dedesubt |
| Eliberați | registrul de eliberări, completat chiar pe pagină |

**Teleconferințele sunt petrecute + amânate.** Cifra cerută de conducere e
totalul, iar el există deja: `tc_total` e **coloană generată** în Postgres
(`tc_petrecute + tc_amanate`, din `0018_hearings.sql`), deci se citește, nu se
recompune — nu poate ajunge să nu corespundă cu cele două cifre din care iese,
indiferent cine scrie în tabelă. Amânatele apar totuși separat, cu corp mic, sub
total: un total care nu spune din ce se compune ridică întrebarea chiar în
dimineața în care nu vrei s-o auzi.

**Eliberările sunt un registru nou**, fiindcă cifra asta nu se ținea minte
nicăieri: un rând pe zi — ziua, câți și o observație opțională —, completat
într-o zonă a paginii care nu se tipărește. Alternativa, un câmp lăsat gol pe
hârtie și scris de mână marți dimineața, a fost respinsă: cifra n-ar rămâne
nicăieri, n-ar putea fi verificată retroactiv, iar dacă cine completează nu știe
numărul exact la ora aceea, întârzie tot raportul. Nu primește tab propriu; două
câmpuri o dată pe săptămână nu fac un modul. Ziua necompletată se vede „—", iar
ziua verificată în care n-a ieșit nimeni se vede „0" — sunt lucruri diferite și
se scriu diferit. Din același motiv **câmpul golit se respinge, nu se salvează
ca 0**: `Number("")` e chiar 0, deci fără verificarea aceea ștergerea cifrei ar
face în tăcere cea mai tare dintre cele două afirmații. Drepturile sunt ca la
ședințe și transferuri: oricine
autentificat citește și completează, ștergerea e a adminului (prin RLS, nu doar
în interfață), iar corecturile rămân în jurnalul de la `/admin`, sub modulul
**Eliberări** — un „3 → 5" scris explicit, fiindcă altfel numărul vechi ar
dispărea odată cu suprascrierea.

Toate patru ies din aceeași funcție (`weeklyFigures`), folosită și de ecran și
de PDF. A doua socoteală, oriunde ar fi scrisă, se desincronizează de prima la
prima modificare — s-a mai întâmplat în proiectul ăsta, cu restanțele: „8"
într-un loc, „1" în altul, aceeași zi. O hârtie tipărită care nu se potrivește
cu ecranul e mai rea decât lipsa raportului.

Raportul spune și ce nu știe, **inclusiv pe hârtie**:

- **zilele lucrătoare fără ședințe introduse** se enumeră deasupra butoanelor de
  export, cu link spre completare: teleconferințele numără doar zilele
  introduse, iar o cifră incompletă, o dată tipărită, nu se mai retrage;
- **„—", nu 0**, când registrul eliberărilor nu poate fi citit. Un zero arată
  exact ca o săptămână în care n-a ieșit nimeni, iar celelalte trei cifre fiind
  corecte, nimeni n-ar avea motiv să se îndoiască tocmai de a patra.

> Migrarea [`supabase/migrations/0026_releases.sql`](supabase/migrations/0026_releases.sql)
> trebuie aplicată (după `0025`); creează tabelul `releases` cu RLS și trigger-ul
> lui de audit. Până atunci pagina se deschide și primele trei cifre sunt
> întregi, dar „Eliberați" rămâne „—" și atât ecranul, cât și PDF-ul scriu de ce.

### Fontul din `src/fonts` — nu-l șterge, nu-l subseta

Două fișiere binare de ~430 KB fiecare, într-un repo de cod, plus un fișier de
licență. Arată exact ca ceva rămas uitat acolo. Nu sunt, iar motivul e scris
aici tocmai fiindcă altfel dispar la prima curățenie:

**Cele paisprezece fonturi standard din PDF nu conțin ș, ț și ă.** Codificarea
lor se oprește la Latin-1, iar literele astea sunt în Latin Extended. Fără un
font încorporat în document, „Ședințe" iese „Sedinte" sau cu pătrate — și nu un
cuvânt, ci aproape fiecare cuvânt al raportului: Plecați, Sosiți, Eliberați,
Date statistice. De aceea Noto Sans e adus în proiect, o dată, cu licența (SIL
Open Font License 1.1) alături, în [`src/fonts/OFL.txt`](src/fonts/OFL.txt) —
licența cere ca ea să însoțească fontul.

**Fontul se încorporează întreg. Nu adăuga `{ subset: true }`.** Un PDF de o
pagină iese pe la 500 KB, aproape numai font, deci subsetarea e primul lucru pe
care cineva va vrea să-l optimizeze. Subsetarea din `@pdf-lib/fontkit` strică
exact literele pentru care a fost adus fontul: glifele compuse — literă + semn,
adică ă, ș, ț, î — rămân fără componentele lor, iar cititorul de PDF le sare.
Încercat, nu presupus: cu subsetare pornită, titlul „Date statistice" se tipărea
**„Da s a s"**.

Ce face capcana serioasă e că **greșeala nu se vede din afara fișierului**:
textul extras din PDF rămâne corect, deci orice verificare automată pe conținut
trece verde. Doar desenul e găurit. Singurul test care o prinde e deschiderea
fișierului cu ochii — și el nu poate rula în CI, deci după orice atingere a
generării PDF-ului descarcă un raport și uită-te la diacritice. Detaliile stau
lângă `embedFont`, în
[`src/app/raport-saptamanal/pdf/route.ts`](src/app/raport-saptamanal/pdf/route.ts).

Fonturile se citesc de pe disc cu `fs`, la fiecare cerere. În funcția de pe
Vercel ajung însă doar fișierele pe care Next le *urmărește*, iar un fișier citit
la rulare nu se vede în niciun import — de aceea
`outputFileTracingIncludes` din [`next.config.mjs`](next.config.mjs) le cară
explicit. Azi analizorul lui Next le prinde și fără intrarea aceea, deci ea nu
repară nimic: e o ancoră. Norocul ține de o euristică pe cod, iar o refactorizare
care compune numele fișierului dintr-o variabilă ar orbi-o, fără nicio eroare la
build — doar „Descarcă PDF" ar începe să dea 500 în producție, unde local merge
oricum, fiindcă acolo repo-ul întreg e pe disc. Verificabil înainte de deploy:
după `npm run build`, ambele `.ttf` trebuie să apară în
`.next/server/app/raport-saptamanal/pdf/route.js.nft.json`, lista după care
Vercel împachetează funcția.

## Dezvoltare locală

1. Instalează dependențele:
   ```bash
   cd apps/task-manager && npm install
   ```
2. Copiază `.env.example` → `.env.local` și completează:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
   (din Supabase → Project Settings → API)
3. Pornește dev server-ul:
   ```bash
   npm run dev
   ```
   → http://localhost:3006
4. Teste:
   ```bash
   npm test          # unit (Vitest)
   npm run test:e2e  # E2E (vezi e2e/README.md)
   ```

## Setup Supabase

Detalii complete în [`supabase/README.md`](supabase/README.md). Pe scurt:

1. Creează un proiect pe [supabase.com](https://supabase.com).
2. În SQL Editor rulează [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Activează providerul Email (Authentication → Providers → Email → *Enable Email
   provider* ON; logarea cu parolă e activă implicit) și lasă *Enable email signups*
   **OFF** — invite-only. Logarea userilor existenți cu parolă funcționează și cu
   signups off.
4. Adaugă cei 4-5 membri din Authentication → Users și **setează-le o parolă**
   (Add user → cu parolă + „Auto Confirm User"). Userii își pot schimba ulterior
   parola din aplicație („Schimbă parola", dreapta-sus în antetul comun).

## Deploy pe Vercel

1. Push branch-ul pe GitHub; importă repo-ul `individul-apps` în Vercel.
2. **Root Directory: `apps/task-manager`**. Framework: Next.js (detectat automat).
3. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. În Supabase → Authentication → URL Configuration adaugă domeniul Vercel la
   Redirect URLs (`https://<app>.vercel.app/auth/callback`).
5. Push pe `main` → deploy automat.

### Regiunea funcțiilor

`vercel.json` fixează `"regions": ["fra1"]` — Frankfurt. Nu e o preferință
estetică: baza de date Supabase a proiectului stă în `eu-central-1`, tot
Frankfurt. Regiunea implicită a Vercel e `iad1` (Washington), iar cu ea fiecare
interogare traversa Atlanticul de două ori.

Măsurat pe `/auth/callback` — o funcție Node care nu atinge baza de date —
costul invocării peste o redirecționare tratată la edge era **~134 ms din
Washington** și e **~66 ms din Frankfurt** (mediana a 12 cereri). Peste asta se
adaugă ~90 ms pentru fiecare citire din Supabase, care din Frankfurt dispar
aproape complet. Câștigul acela nu se vede în măsurătoarea de mai sus, fiindcă
endpointul ales nu interoghează nimic — se vede pe paginile reale.

Dacă vreodată se mută proiectul Supabase în altă regiune, **mută și asta odată
cu el**. Codul și baza de date trebuie să stea în același oraș.

## Copie de siguranță

O copie care se oprește în tăcere e mai rea decât lipsa uneia: te crezi acoperit
tocmai când nu ești. De aceea fiecare rulare lasă urmă, iar starea copiei se vede
pe `/admin`, sub titlu — fără s-o caute cineva.

### Ce acoperă Supabase Pro și ce nu

Planul Pro face o copie zilnică a **bazei de date**, păstrată **7 zile**. Atât.

- **Fișierele nu sunt acoperite deloc.** Documentația Supabase o spune pe față:
  copiile bazei „do not include objects you store via the Storage API" — baza știe
  că există un scan și cum îl cheamă, dar conținutul lui nu e salvat nicăieri.
  Scanurile petițiilor și fișierele `.xlsx` importate la statistici n-au avut,
  până la copia asta, nicio copie.
- **Fereastra e de 7 zile.** O ștergere observată a opta zi nu se mai poate repara:
  copia cu datele bune a expirat. Recuperarea la un moment anume (PITR) e supliment
  separat, de la ~100 $/lună — nu intră în Pro.

### Ce face copia noastră

În fiecare noapte, Vercel Cron cheamă `/api/backup`. Ruta citește cu cheia de
serviciu — deci vede tot, indiferent de RLS — și scrie într-un **repo privat pe
GitHub**:

- **baza de date**, toate cele 15 tabele, într-un fișier pe zi (`db/2026-07-31.json`).
  Fiindcă e versionat de git, se poate reveni la starea de acum trei luni, nu doar
  la ultimele șapte zile;
- **fișierele din Storage**, sub `files/<bucket>/…`, plus `manifest.json` —
  evidența celor deja salvate. Bucketele nu sunt scrise nicăieri în cod: ruta le
  cere de la Storage, deci unul adăugat mai târziu intră în copie de la sine
  (azi sunt `petitions` și `statistics`).

**Fișierele se copiază o singură dată.** Un scan se încarcă și nu se mai schimbă
niciodată, deci fiecare noapte urcă doar ce e nou față de manifest. Baza de date,
în schimb, se rescrie întreagă zilnic: rândurile se modifică, iar textul e ieftin.

Într-o rulare se urcă cel mult **15 fișiere**, și după **40 de secunde** de la
pornire nu se mai începe niciunul nou — o funcție Vercel are un minut cu totul, iar
ultimele douăzeci de secunde sunt pentru manifest și închiderea rulării. De aceea
**prima rulare nu aduce tot**: fișierele deja existente se recuperează pe parcursul
câtorva nopți, iar „încă N fișiere de copiat", pe `/admin`, e normal atâta timp cât
cifra scade de la o zi la alta. Restanța care **nu** scade e singurul semnal rău.

**Ora e aproximativă.** Programarea e `0 2 * * *` — 2 noaptea, când nu lucrează
nimeni. Pe planul Hobby, Vercel împrăștie cronurile în interiorul orei cerute, deci
rularea poate porni oricând între 02:00 și 02:59 (pe Pro, în minutul cerut). O copie
făcută la 02:47 nu e o defecțiune. Pragul de vechime e la 3 zile, cu mult peste
abaterea asta, deci nu produce alarme false.

**Ce nu se copiază, dinadins:** conturile de autentificare (email, parolă). Stau în
`auth.users`, iar parolele n-au ce căuta copiate în altă parte. Sunt patru-cinci
oameni; la o restaurare se creează din nou, de mână (vezi procedura de mai jos).

**Copia de noapte e copia de bază**, nu fișierul luat cu „Descarcă backup (JSON)"
de pe `/admin`. Amândouă trec prin același cod și ies în același format, dar butonul
citește cu sesiunea adminului, deci prin RLS: politica de la `notifications` dă
fiecăruia doar rândurile lui (`user_id = auth.uid()`), așa că fișierul descărcat
manual conține notificările celui care l-a descărcat, nu ale echipei. Copia de
noapte, făcută cu cheia de serviciu, le are pe toate.

### Configurarea, pas cu pas

1. **Un repo privat nou pe GitHub.** Vizibilitate **Private** și bifează „Add a
   README", ca repo-ul să aibă o ramură implicită de la bun început. Numele lui,
   sub forma `proprietar/nume`, intră la pasul 3.
2. **Un token fine-grained**, cu drepturi doar pe acel repo: GitHub → Settings →
   Developer settings → Personal access tokens → Fine-grained tokens → Generate new
   token. Acolo:
   - **Repository access:** „Only select repositories" → repo-ul de la pasul 1;
   - **Permissions → Repository permissions → Contents: „Read and write"**. Nimic
     altceva — un token care poate scrie într-un singur repo privat e tot ce-i
     trebuie copiei.

   Tokenul se vede **o singură dată**, la creare, și se lipește **doar** în ecranul
   de variabile din Vercel (pasul 3) — nicăieri altundeva. Are și termen de
   expirare: notează-ți-l, fiindcă în ziua în care expiră copia începe să cadă cu
   401, iar banda de pe `/admin` se face galbenă abia după trei zile.
3. **Variabilele în Vercel** → proiectul → Settings → Environment Variables:

   | Variabilă | Valoare |
   | --------- | ------- |
   | `GITHUB_BACKUP_REPO` | `proprietar/nume` — atât, nu linkul din bara de adrese |
   | `GITHUB_BACKUP_TOKEN` | tokenul de la pasul 2 |
   | `CRON_SECRET` | un șir aleatoriu, minimum 16 caractere |

   `CRON_SECRET` nu se configurează nicăieri altundeva: Vercel îl trimite singur ca
   antet `Authorization: Bearer …` la fiecare declanșare, iar ruta compară. Fără el
   ruta răspunde 500 și nu copiază nimic — una care citește toată baza cu cheia de
   serviciu n-are voie să meargă neprotejată.

   Copia are nevoie și de `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings →
   API → `service_role`), deja necesară pentru „Adaugă utilizator" din `/admin`.
   Dacă lipsește, adaug-o tot aici.
4. **Redeploy.** Cronul se citește din `vercel.json` la deploy, nu din tabloul de
   bord: până la primul deploy de după modificare, pur și simplu nu există.
5. **Verifică** că a apărut, în Vercel → Settings → Cron Jobs. Prima rulare se poate
   forța, fără să aștepți noaptea:

   ```bash
   curl -i -H "Authorization: Bearer $CRON_SECRET" https://<domeniul-aplicației>/api/backup
   ```

   Răspunsul spune câte tabele, câte rânduri, câte fișiere s-au urcat și câte au mai
   rămas. Aceleași cifre ajung în `backup_runs` și de acolo pe `/admin`.

### Când ceva nu merge

Banda de pe `/admin` nu spune doar că e rău, ci **unde să te uiți** — fiindcă
„programarea nu pornește" și „rularea cade" se caută în locuri diferite:

| Ce scrie pe `/admin` | Unde te uiți |
| -------------------- | ------------ |
| „Programarea zilnică nu s-a declanșat încă niciodată" / „Nu mai pornește nicio rulare" | Vercel → Settings → Cron Jobs: cronul e listat? nu cumva e dezactivat? |
| „Cronul pornește, dar rularea nu ajunge la capăt" / „rulările de după au eșuat" | Vercel → Settings → Cron Jobs → **View Logs**, adică jurnalul filtrat pe `/api/backup` |
| „Încă N fișiere de copiat" | nimic, dacă N scade de la o zi la alta — așa se recuperează fișierele vechi |

Motivul ultimei încercări apare sub bandă, tăiat la cât se citește dintr-o privire;
întreg e în jurnalul din Vercel. Cele mai frecvente: **401** — tokenul a expirat sau
e greșit, înlocuiește `GITHUB_BACKUP_TOKEN`; **404** — `GITHUB_BACKUP_REPO` e greșit
**sau** tokenul n-are acces la exact acel repo, fiindcă GitHub răspunde tot 404 când
accesul lipsește.

### Procedura de restaurare

Nu există buton pentru toate tabelele, dinadins: ordinea inserărilor contează, iar
cine restaurează e de obicei un om speriat care tocmai a pierdut ceva. Un buton
apăsat în panică peste date bune e mai periculos decât lipsa lui. („Restaurează din
backup", de pe `/admin`, acoperă doar formatul vechi, cu patru tabele, și refuză
explicit un fișier de azi.)

**Fișierul** e `db/<zi>.json` din repo. Are `counts` — câte rânduri avea fiecare
tabel — bun de comparat la final, și `data`, cu rândurile propriu-zise.

**Ordinea o dă fișierul.** Cheile din `data` sunt scrise în ordinea cheilor străine,
părintele înaintea copilului, iar blocul de la pasul 4 le parcurge exact în ordinea
în care le găsește. Nu există listă de ținut minte și nici de actualizat când apare
un tabel nou.

**1. Dacă baza există și s-au pierdut doar date**, sari direct la pasul 4.

**2. Proiect nou.** În SQL Editor, rulează migrările din `supabase/migrations/` **în
ordinea numerelor**, de la `0001_init.sql` la `0022_backup_runs.sql`. Tot ele creează
bucketele `petitions` și `statistics`.

**3. Conturile**, care nu sunt în copie — dar **cu id-urile din copie**. `profiles.id`
e chiar id-ul contului de autentificare, iar toate celelalte tabele arată spre el;
conturi create din tabloul de bord ar primi id-uri noi și n-ar mai corespunde nimic
(inserarea profilurilor ar cădea pe cheia străină). De aceea se creează prin Admin
API, câte unul, cu id-ul luat din `data.profiles`:

```bash
curl -X POST "https://<proiect>.supabase.co/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"<id-ul din data.profiles>","email":"ion@exemplu.md","password":"<parolă temporară>","email_confirm":true}'
```

Emailurile nu sunt în copie — se iau din proiectul vechi, dacă mai există, altfel de
la oameni. Numele, username-ul și rolul vin din copie, la pasul următor. Parola
temporară se schimbă din aplicație („Schimbă parola").

Triggerul `handle_new_user` a creat între timp câte un profil gol pentru fiecare cont
nou. Șterge-le, ca rândurile adevărate din copie să intre în locul lor — pe o bază
proaspătă n-are ce altceva să șteargă:

```sql
delete from profiles;
```

**4. Rândurile.** Un singur bloc, rulat o dată în SQL Editor. Deschizi fișierul
copiei, îi selectezi tot conținutul și-l lipești unde scrie:

```sql
do $restaurare$
declare
  copie json := $dump$
„aici se lipește tot conținutul fișierului db/<zi>.json — linia asta se înlocuiește"
$dump$::json;
  tabel   text;
  randuri json;
  coloane text;
begin
  -- `json`, nu `jsonb`: numai `json` păstrează ordinea cheilor din fișier, adică
  -- ordinea cheilor străine — părintele înaintea copilului.
  for tabel, randuri in select key, value from json_each(copie -> 'data') loop
    -- Coloanele generate (`petitions.response_deadline`, totalurile de la ședințe
    -- și transferuri) se sar: Postgres refuză o inserare care le dă valoare.
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into coloane
      from information_schema.columns
     where table_schema = 'public' and table_name = tabel and is_generated = 'NEVER';

    execute format(
      'insert into public.%I (%s) select %s from json_populate_recordset(null::public.%I, $1) on conflict do nothing',
      tabel, coloane, coloane, tabel
    ) using randuri;
  end loop;
end
$restaurare$;
```

Ce face și ce nu face:

- **adaugă doar ce lipsește** (`on conflict do nothing`): nu suprascrie și nu șterge
  nimic. Un rând care există, dar a fost *modificat* greșit, rămâne cum e — pe acela
  îl repari de mână, comparând cu fișierul;
- **e o singură tranzacție**: dacă se oprește la al treisprezecelea tabel, nu rămâne
  nimic pe jumătate;
- se poate rula de două ori fără pagubă.

Dacă fișierul e prea mare pentru editor, lipește un `data` cu doar câteva tabele
odată — **păstrând ordinea din fișier** — și rulează blocul de mai multe ori.

Trigger-ele de audit se declanșează și la restaurare, deci în `audit_log` apar, pe
lângă rândurile vechi din copie, și intrări de azi fără autor (în SQL Editor nu
există `auth.uid()`). Nu strică nimic și se recunosc după autorul lipsă.

**5. Verifică** numărând, și comparând cu `counts` din fișier:

```sql
select count(*) from petitions;
```

**6. Fișierele.** Clonează repo-ul de backup și urcă înapoi conținutul lui
`files/<bucket>/` în bucketul cu același nume, **pe aceleași căi**:
`files/petitions/<id-petiție>/scan.pdf` se duce la `petitions/<id-petiție>/scan.pdf`.
Rândurile din `petition_attachments` și `stat_reports` țin calea, deci un fișier
urcat altundeva nu se mai deschide din aplicație.

**7. Dacă proiectul Supabase e nou**, variabilele din Vercel
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) trebuie să arate spre el, iar domeniul aplicației
readăugat la Redirect URLs în Supabase. Banda de pe `/admin` va spune, până la prima
noapte, că nu există nicio copie reușită: `backup_runs` e evidența copierii, nu date
ale instituției, deci nu intră în dump și nu se restaurează.

### Peretele de peste ani

`manifest.json` crește cu ~120 de baiți la fiecare fișier salvat, iar Contents API
trimite conținutul inline doar sub **1 MB**. Undeva la **8–10 mii de fișiere**
manifestul trece pragul, iar copia se oprește cu o eroare limpede („…n-are conținut
inline. Ori calea arată spre un director, ori fișierul trece de 1 MB"). La ritmul de
acum sunt ani până acolo, dar peretele e real și e scris aici ca cel care-l atinge
să nu caute o defecțiune inexistentă: atunci manifestul trebuie spart în bucăți
(unul pe bucket, sau pe an), nu reparat.

> Migrarea [`supabase/migrations/0022_backup_runs.sql`](supabase/migrations/0022_backup_runs.sql)
> trebuie aplicată (după `0021`) — până atunci ruta de copiere se oprește la prima
> propoziție, fiindcă n-are unde deschide rularea. Creează tabelul `backup_runs`,
> citibil doar de admini; scrie în el exclusiv cheia de serviciu, deci nimeni din
> aplicație nu poate falsifica o rulare reușită.

## Structură

```
apps/task-manager/
├── src/
│   ├── app/
│   │   ├── login/           # pagină login (email + parolă)
│   │   ├── account/         # schimbare parolă (Server Action)
│   │   ├── auth/            # callback + signout (Route Handlers)
│   │   ├── sarcini/         # lista de sarcini
│   │   ├── petitii/         # registrul petițiilor + actions.ts
│   │   ├── tasks/           # [id] detaliu, actions.ts; /tasks → redirect /sarcini
│   │   ├── admin/           # administrare (doar admin)
│   │   ├── layout.tsx
│   │   └── page.tsx         # hub (carduri de modul cu cifre live)
│   ├── components/
│   │   ├── ui/             # componente shadcn/ui
│   │   ├── layout/         # antetul comun + tab-urile de modul
│   │   ├── hub/            # cardul de modul de pe pagina de start
│   │   ├── petitions/      # listă + formular petiții
│   │   └── tasks/          # tabel, formular, detaliu, etichete, comentarii
│   ├── lib/
│   │   ├── supabase/       # clienți server/browser + middleware
│   │   ├── queries.ts      # citiri Supabase
│   │   ├── schemas.ts      # zod
│   │   ├── types.ts
│   │   ├── task-filters.ts # helper-e filtrare/sortare (testate)
│   │   ├── hub-stats.ts    # cifrele de pe hub (testate)
│   │   └── permissions.ts  # helper permisiuni (testat)
│   └── middleware.ts       # refresh sesiune + protecție rute
├── supabase/
│   ├── migrations/0001_init.sql
│   └── README.md
└── e2e/                    # teste Playwright
```
