import { differenceInCalendarDays, format } from "date-fns";

export interface StoredFile {
  bucket: string;
  name: string;
  size: number;
}

/** Un fișier pe zi pentru baza de date; git le păstrează pe toate. */
export function dumpPath(d: Date): string {
  return `db/${format(d, "yyyy-MM-dd")}.json`;
}

/**
 * A reușit deja o copie pentru ziua pe care ar scrie-o rularea de acum?
 *
 * A doua rulare a nopții e doar plasă de siguranță, pentru cazul în care prima
 * e omorâtă la mijloc. Dacă prima a mers, a doua n-are ce adăuga: ar rescrie
 * exact același fișier.
 *
 * Comparația se face pe numele fișierului, nu pe ore: aceea e chiar unitatea în
 * care se măsoară o copie, deci „acoperit" nu poate ajunge să însemne altceva
 * decât „fișierul zilei există".
 *
 * La dată lipsă sau ilizibilă răspunsul e „nu": spre deosebire de `isStale`,
 * unde necunoscutul trebuie să dea alarmă, aici necunoscutul trebuie să lase
 * copia să ruleze. Ambele greșesc în direcția în care datele rămân salvate.
 */
export function alreadyCovered(lastSuccessISO: string | null, now: Date): boolean {
  if (!lastSuccessISO) return false;
  const t = new Date(lastSuccessISO);
  if (Number.isNaN(t.getTime())) return false;
  return dumpPath(t) === dumpPath(now);
}

/** Bucketul intră în cale: două buckete pot avea fișiere cu același nume. */
export function filePath(bucket: string, name: string): string {
  return `files/${bucket}/${name}`;
}

const keyOf = (f: StoredFile) => `${f.bucket}/${f.name}/${f.size}`;

/**
 * Ce e în buckete și nu e în manifest.
 *
 * Mărimea intră în cheie, nu doar numele: dacă un fișier a fost înlocuit cu
 * altul sub același nume, manifestul ar spune „salvat" pentru un conținut pe
 * care nu-l are. Scanurile nu se schimbă, dar tăcerea în cazul contrar ar
 * însemna pierdere de date.
 */
export function missingFiles(inBucket: StoredFile[], saved: StoredFile[]): StoredFile[] {
  const have = new Set(saved.map(keyOf));
  return inBucket.filter((f) => !have.has(keyOf(f)));
}

/**
 * De ce refuză restaurarea automată fișierul? `null` înseamnă că-l acceptă.
 *
 * Butonul de restaurare știe patru tabele — sarcini, etichete, legături,
 * comentarii — adică formatul vechi (`version: 1`). Copiile de azi au
 * cincisprezece tabele și scriu `version: 2`.
 *
 * Refuzul e intenționat, nu o lipsă de timp. Un import parțial peste o bază de
 * date reală e mai periculos decât lipsa butonului: ordinea inserărilor
 * contează (profilurile înaintea sarcinilor, petițiile înaintea atașamentelor),
 * iar cine apasă e, de obicei, un om speriat care tocmai a pierdut ceva. O
 * restaurare se face o dată la câțiva ani, cu capul limpede, după procedura din
 * README — nu în panică, dintr-un buton care ia jumătate din date.
 *
 * De aceea refuzul e explicit: mai bine „nu pot" decât o reușită care lasă
 * treisprezece tabele afară fără să spună.
 */
export function restoreRefusal(payload: unknown): string | null {
  // `Number` prinde și „2" scris ca text; lipsa câmpului dă NaN, deci fișierele
  // vechi trec mai departe la validarea de conținut, ca înainte.
  const version = Number((payload as { version?: unknown } | null)?.version);
  if (!Number.isFinite(version) || version <= 1) return null;

  return (
    `Fișierul e în formatul complet (versiunea ${version}, toate tabelele). ` +
    `Restaurarea automată acoperă doar formatul vechi — vezi README pentru ` +
    `procedura de restaurare completă.`
  );
}

/**
 * A trecut prea mult de la ultima rulare reușită?
 *
 * `null` — nicio reușită vreodată — înseamnă învechit, nu „în regulă până la
 * proba contrarie": exact atunci trebuie să afli.
 *
 * Un timestamp ilizibil primește același răspuns ca `null`, din același motiv:
 * în ambele cazuri lipsește dovada că o copie a reușit. Fără garda de mai jos
 * data invalidă ar da NaN, iar `NaN > maxDays` e false — adică tocmai
 * liniștirea falsă pe care evidența rulărilor există s-o prevină.
 */
export function isStale(lastSuccessISO: string | null, today: Date, maxDays = 3): boolean {
  if (!lastSuccessISO) return true;
  const t = new Date(lastSuccessISO);
  if (Number.isNaN(t.getTime())) return true;
  return differenceInCalendarDays(today, t) > maxDays;
}

/* -------------------------------------------------------------------------- */
/* Starea copiei, așa cum o vede adminul                                      */
/* -------------------------------------------------------------------------- */

/** Un rând din evidența rulărilor, cu ce citește panoul din el. */
export interface BackupRun {
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  files_uploaded: number;
  files_pending: number;
  error: string | null;
}

/**
 * Ce s-a întâmplat, în stări separate fiindcă fiecare cere altă verificare.
 *
 * Deosebirea care contează e între „cronul nu pornește" și „cronul pornește,
 * dar rularea cade": prima se caută în programare, a doua în jurnalul rulării.
 * Un panou care le-ar arăta pe amândouă ca „ceva nu merge" ar trimite omul să
 * caute în locul greșit — ceea ce e mai rău decât să nu spună nimic.
 */
export type BackupStateKind =
  | "niciodata"
  | "in-curs"
  | "nicio-reusita"
  | "oprit"
  | "esuat"
  | "esuare-recenta"
  | "in-regula";

export interface BackupState {
  kind: BackupStateKind;
  /**
   * Cât de tare se vede. Greutatea urmează un singur criteriu — ești acoperit
   * acum sau nu — nu „s-a întâmplat ceva": `warn` înseamnă că nu ești, `info`
   * că ești, dar ceva a început să se strice.
   */
  level: "ok" | "info" | "warn";
  /** Când a reușit ultima oară; `null` dacă niciodată sau dacă data e ilizibilă. */
  lastSuccessAt: string | null;
  /** Zile calendaristice de atunci; `null` când nu există o dată bună. */
  daysSince: number | null;
  /**
   * Fișiere rămase de recuperat **la ultima rulare reușită** — care poate fi de
   * acum câteva zile. Vezi capcana 1 din `backupStatus` de ce numai de acolo.
   *
   * Când copia nu e la zi, cifra e o amintire, nu o măsurătoare: de atunci pot
   * fi mai multe. Pagina o spune la trecut, legată de rularea aceea.
   */
  filesPending: number;
  /** Motivul ultimei încercări încheiate cu eșec, pe un rând și tăiat. */
  error: string | null;
  /** Ce să verifici; gol doar când totul e în regulă. */
  hint: string;
}

/**
 * Cât timp după pornire o rulare neîncheiată e considerată încă în lucru.
 *
 * Ruta are `maxDuration = 60`, deci cinci minute e cu mult peste. Marja e
 * dinadins largă: greșeala scumpă e cealaltă — să strigi „a eșuat" peste o
 * rulare care încă lucrează. Cine tocmai a pornit copia manual, după procedura
 * din README, ar citi o alarmă falsă exact în minutul în care se uită la pagină.
 */
const RUNNING_WINDOW_MS = 5 * 60_000;

/**
 * Cât din motivul erorii intră în pagină.
 *
 * Ruta taie deja la 2000 de caractere la scriere, dar asta e plasa serverului,
 * nu a paginii: 2000 de caractere într-o bandă de avertizare rămân un zid de
 * text. Aici se taie la cât se citește dintr-o privire, iar restul se caută în
 * jurnalul din Vercel — unde oricum e întreg.
 */
const MAX_ERROR_CHARS = 240;

/**
 * Motivul, adus la un rând și scurtat.
 *
 * Textul vine dintr-un răspuns HTTP străin, deci poate fi o pagină de eroare
 * întreagă, cu zeci de rânduri. React îl scapă la afișare, deci nu e o problemă
 * de securitate — e una de așezare în pagină: spațiile albe se strâng la unul
 * singur ca să nu crească banda pe verticală, iar lungimea se taie.
 */
function shortError(text: string | null): string | null {
  if (!text) return null;
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return null;
  return oneLine.length > MAX_ERROR_CHARS ? `${oneLine.slice(0, MAX_ERROR_CHARS)}…` : oneLine;
}

/** O rulare deschisă acum câteva secunde lucrează; una veche a fost omorâtă. */
function isRunning(run: BackupRun, now: Date): boolean {
  if (run.ok || run.finished_at !== null) return false;
  const started = new Date(run.started_at).getTime();
  // Data ilizibilă nu primește prezumția de nevinovăție: fără ea nu se poate
  // spune că lucrează, iar „a eșuat" e citirea sigură.
  if (Number.isNaN(started)) return false;
  return now.getTime() - started < RUNNING_WINDOW_MS;
}

const HINTS: Record<BackupStateKind, string> = {
  niciodata:
    "Programarea zilnică nu s-a declanșat încă niciodată: verifică Vercel → Settings → " +
    "Cron Jobs și dacă `CRON_SECRET` e setat în Environment Variables.",
  "in-curs":
    "O rulare e în curs chiar acum — reîncarcă pagina peste un minut ca să vezi cum " +
    "s-a încheiat.",
  // Jurnalul unei rulări de cron se deschide din pagina cronului, nu căutându-l
  // prin deploy-uri: butonul „View Logs" de lângă el duce direct la jurnalul
  // filtrat pe rută. Un drum mai lung ar cere să ghicești întâi care deploy a
  // rulat copia de azi-noapte.
  "nicio-reusita":
    "Cronul pornește, dar rularea nu ajunge la capăt. Deschide jurnalul rulării din " +
    "Vercel → Settings → Cron Jobs → View Logs (filtrat pe /api/backup).",
  // Fraza nu se sprijină pe data de dinaintea ei („de atunci n-a mai…"): când
  // rândul reușitei are un timestamp ilizibil, data lipsește din pagină și
  // referința ar rămâne în aer.
  oprit:
    "Nu mai pornește nicio rulare: nu rularea cade, ci programarea nu se declanșează. " +
    "Verifică Vercel → Settings → Cron Jobs.",
  esuat:
    "Cronul pornește, dar rulările de după au eșuat. Deschide jurnalul rulării din " +
    "Vercel → Settings → Cron Jobs → View Logs (filtrat pe /api/backup).",
  "esuare-recenta":
    "Copia e încă recentă, deci nu e urgent — dar dacă eșecul se repetă câteva nopți " +
    "la rând nu mai ești acoperit. Verifică jurnalul rulării în Vercel.",
  "in-regula": "",
};

/**
 * Starea copiei din ultima rulare și ultima rulare reușită.
 *
 * `now` e momentul curent, nu doar ziua: „o rulare e în curs" se măsoară în
 * minute.
 *
 * Trei lucruri pe care le-ar greși o citire naivă a ultimului rând:
 *
 * 1. **`files_pending` se ia numai de la o reușită.** Ruta îl scrie *după*
 *    etapa fișierelor, deci o rulare căzută înainte de ea îl lasă 0. Citit din
 *    ultimul rând, indiferent de `ok`, ar arăta un liniștitor „0 de recuperat"
 *    tocmai pentru o rulare care n-a ajuns până acolo.
 * 2. **Sunt două întrebări, nu una.** Când a reușit ultima copie și dacă
 *    ultima încercare a căzut sunt lucruri diferite: un eșec de azi-noapte
 *    peste o reușită de alaltăieri nu e încă învechit, dar nici tăcere nu
 *    merită.
 * 3. **Fără reușită, felul eșecului spune unde să cauți.** Dacă ultima rulare a
 *    reușit și totuși e învechită, înseamnă că de atunci n-a mai pornit nimic —
 *    programarea, nu rularea. Dacă ultima a eșuat, invers.
 */
export function backupStatus(
  runs: { last: BackupRun | null; lastSuccess: BackupRun | null },
  now: Date,
): BackupState {
  const { last, lastSuccess } = runs;

  // `finished_at` e momentul în care copia chiar exista; `started_at` e plasa
  // pentru un rând închis strâmb.
  const successAt = lastSuccess ? (lastSuccess.finished_at ?? lastSuccess.started_at) : null;
  // O dată ilizibilă se tratează ca lipsă, ca în `isStale`: în ambele cazuri
  // lipsește dovada că o copie a reușit, iar o dată invalidă pusă în pagină ar
  // arunca la formatare și ar lăsa adminul fără pagină.
  const successTime = successAt ? new Date(successAt).getTime() : Number.NaN;
  const lastSuccessAt = Number.isNaN(successTime) ? null : successAt;

  const daysSince = lastSuccessAt
    ? differenceInCalendarDays(now, new Date(lastSuccessAt))
    : null;
  // Capcana 1: numai de la o rulare reușită — deci o cifră de atunci, nu de
  // acum. Cine o afișează trebuie s-o spună ca atare când reușita e veche.
  const filesPending = lastSuccess?.files_pending ?? 0;

  const running = last !== null && isRunning(last, now);
  // O rulare în curs n-a eșuat încă, oricât ar arăta rândul ei de deschis.
  const failed = last !== null && !last.ok && !running;

  const base = {
    lastSuccessAt,
    daysSince,
    filesPending,
    error: failed ? shortError(last.error) : null,
  };

  const state = (kind: BackupStateKind, level: BackupState["level"]): BackupState => ({
    ...base,
    kind,
    level,
    hint: HINTS[kind],
  });

  const stale = isStale(lastSuccessAt, now);

  // Niciun rând: starea de dinainte de prima rulare. Nu e „în regulă până la
  // proba contrarie" — atunci fișierele chiar n-au nicio copie.
  if (!last) return state("niciodata", "warn");
  // Înaintea celorlalte: cât timp lucrează, orice diagnostic e prematur.
  if (running) return state("in-curs", stale ? "warn" : "ok");
  if (!lastSuccess) return state("nicio-reusita", "warn");
  if (stale) return state(failed ? "esuat" : "oprit", "warn");
  // Capcana 2: copia e la zi, dar ceva a început să cadă. Se vede, fără galben.
  if (failed) return state("esuare-recenta", "info");
  return state("in-regula", "ok");
}
