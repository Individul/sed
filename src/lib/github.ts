/**
 * Scrierea fișierelor în repo-ul privat de backup, prin Contents API.
 *
 * Regula care ține modulul ăsta: **tokenul nu iese de aici.**
 *
 * Motivul e mai tare decât igiena obișnuită: mesajele de eroare de aici ajung în
 * `backup_runs.error`, de unde panoul de pe `/admin` le pune pe ecran, iar
 * răspunsul rutei de cron le duce în jurnalul din Vercel. Un token scăpat
 * într-un mesaj ar ajunge deodată afișat în pagină și scris în jurnale.
 *
 * Cum se ține regula, ca să poată fi verificată prin citire, nu prin încredere:
 * - tokenul e citit într-un singur loc (`loadConfig`) și folosit într-unul
 *   singur (antetul `Authorization` din `apiHeaders`); nu intră în URL;
 * - orice text compus din răspunsul GitHub trece prin `redact`;
 * - și cererile care nici nu ajung la GitHub (rețea căzută, timeout) trec pe
 *   acolo: `askGitHub` prinde respingerea lui `fetch`. O regulă cu o singură
 *   excepție nu mai e regulă, iar excepția n-are cum să fie ținută minte;
 * - singurele mesaje care nu trec sunt cele din `loadConfig`/`parseRepo`, fiindcă
 *   sunt constante care **nu interpolează nimic** — anume nu dau înapoi valoarea
 *   citită din mediu, ca o variabilă completată greșit (tokenul pus din greșeală
 *   în `GITHUB_BACKUP_REPO`) să nu se întoarcă în mesaj;
 * - corpul cererii se compune în `putBody`, care nu primește configurarea, deci
 *   `JSON.stringify` de pe el n-are ce scăpa;
 * - nu există `console.*` nicăieri în fișier.
 */

const API = "https://api.github.com";

export type PutResult = { ok: true } | { ok: false; error: string };

interface Repo {
  owner: string;
  name: string;
}

interface Config extends Repo {
  token: string;
}

interface PutBody {
  message: string;
  content: string;
  sha?: string;
}

const UNDE_SE_SETEAZA =
  ` Se setează în Vercel → Settings → Environment Variables (vezi README, secțiunea „Copie de siguranță").`;

/**
 * Ultima plasă înainte ca un text să iasă din modul.
 *
 * Tokenul n-ar trebui să ajungă niciodată într-un mesaj, dar „n-ar trebui" ține
 * doar cât ține atenția celui care schimbă fișierul peste un an. Aici garanția
 * nu depinde de atenție: dacă tokenul e totuși în text, iese ascuns.
 *
 * `split`/`join` în loc de `replaceAll`: caută text brut, fără nicio semantică
 * de tipar nici în ce se caută, nici în ce se pune în loc.
 */
export function redact(text: string, token: string): string {
  if (!token) return text;
  return text.split(token).join("[token ascuns]");
}

/**
 * `proprietar/nume` din variabila de mediu, sau mesajul de arătat.
 *
 * Verificarea formei nu e pedanterie: un URL întreg copiat din bara de adrese
 * sau doar numele repo-ului ar ajunge la GitHub ca un 404 — același 404 pe care
 * îl dă și un token fără drepturi. Mai bine spunem din prima ce e greșit decât
 * să lăsăm utilizatorul să caute între trei cauze posibile.
 */
export function parseRepo(value: string | undefined): Repo | string {
  const raw = (value ?? "").trim();
  if (!raw) {
    return `GITHUB_BACKUP_REPO nu e configurată, deci copia nu știe unde să scrie.${UNDE_SE_SETEAZA}`;
  }

  const parts = raw.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return (
      `GITHUB_BACKUP_REPO trebuie să aibă forma „proprietar/nume" (ex. „ion/backup-sarcini"), ` +
      `nu un link întreg și nu doar numele repo-ului.${UNDE_SE_SETEAZA}`
    );
  }

  return { owner: parts[0], name: parts[1] };
}

/** Configurarea întreagă, sau primul lucru care lipsește. */
function loadConfig(): Config | string {
  const repo = parseRepo(process.env.GITHUB_BACKUP_REPO);
  if (typeof repo === "string") return repo;

  const token = (process.env.GITHUB_BACKUP_TOKEN ?? "").trim();
  if (!token) {
    return `GITHUB_BACKUP_TOKEN nu e configurat, deci copia nu poate scrie în repo.${UNDE_SE_SETEAZA}`;
  }

  return { ...repo, token };
}

/**
 * Calea intră în URL, dar segmentele se codifică separat: „/" desparte
 * directoarele pentru Contents API și trebuie să rămână „/", pe când spațiile
 * și diacriticele dintr-un nume de scan („Cerere Ionuț nr. 12.pdf") trebuie
 * codificate, altfel cererea pleacă stricată sau nimerește altă cale.
 */
export function contentsUrl(repo: Repo, path: string): string {
  const owner = encodeURIComponent(repo.owner);
  const name = encodeURIComponent(repo.name);
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${API}/repos/${owner}/${name}/contents/${encoded}`;
}

/** Singurul loc din aplicație în care tokenul e pus într-un antet. */
function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Corpul cererii de scriere.
 *
 * Cu sha → suprascriere; fără sha → fișier nou. Când nu există sha, cheia
 * lipsește cu totul: `sha: null` nu e totuna cu absența ei pentru Contents API,
 * care respinge valoarea nulă în loc să creeze fișierul.
 */
export function putBody(message: string, content: Buffer, sha: string | null): PutBody {
  const base = { message, content: content.toString("base64") };
  return sha ? { ...base, sha } : base;
}

/** Corp care nu e JSON (o pagină de eroare de la un proxy, un răspuns gol). */
async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function textField(
  body: unknown,
  key: "sha" | "message" | "content" | "encoding",
): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/**
 * Mesajul pentru un răspuns respins: ce s-a întâmplat și ce e de verificat.
 *
 * Din corpul răspunsului se ia **doar** câmpul `message` al GitHubului. Nu tot
 * corpul și cu atât mai puțin cererea trimisă: o eroare care ajunge în evidența
 * rulărilor trebuie să conțină strictul necesar ca s-o poți repara.
 */
async function describe(res: Response, action: string, path: string): Promise<string> {
  const detail = textField(await readJson(res), "message");
  const spune = detail ? ` GitHub a răspuns: „${detail}".` : "";

  switch (res.status) {
    case 401:
      return (
        `GitHub a refuzat autentificarea la ${action} „${path}". Tokenul e greșit sau ` +
        `expirat — înlocuiește GITHUB_BACKUP_TOKEN în Vercel.${spune}`
      );
    case 403:
      return (
        `GitHub a refuzat ${action} „${path}" (403). Tokenul are nevoie de dreptul ` +
        `„Contents: write" pe repo-ul de backup, sau s-a atins limita de cereri.${spune}`
      );
    case 404:
      return (
        `GitHub n-a găsit repo-ul la ${action} „${path}". Verifică GITHUB_BACKUP_REPO și ` +
        `că tokenul are acces la exact acel repo — GitHub răspunde tot 404 când accesul ` +
        `lipsește, nu doar când repo-ul nu există.${spune}`
      );
    case 409:
    case 422:
      return (
        `Scrierea „${path}" s-a ciocnit cu altă modificare din repo (${res.status}). ` +
        `Rularea de mâine o reia.${spune}`
      );
    default:
      return `GitHub a răspuns ${res.status} la ${action} „${path}".${spune}`;
  }
}

/** Orice poate fi aruncat, nu doar `Error` (rețea căzută, timeout, altceva). */
function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * O citire din Contents API, cu tot ce trebuie să fie la fel la amândouă.
 *
 * `cache: "no-store"` fiindcă Next.js pune un cache peste `fetch`, iar aici
 * amândoi apelanții au nevoie de starea de acum: un sha vechi ar duce la o
 * suprascriere respinsă, iar un manifest de ieri ar face rularea să reurce
 * fișierele de care ieri s-a ocupat deja.
 *
 * Respingerea lui `fetch` — rețea căzută, DNS, timeout — se prinde aici, nu în
 * apelant: mesajele ei n-au azi antete în ele, dar regula modulului e „tot ce
 * pleacă trece prin `redact`", iar o regulă cu o excepție nu mai e regulă.
 */
async function askGitHub(config: Config, path: string, action: string): Promise<Response> {
  try {
    return await fetch(contentsUrl(config, path), {
      headers: apiHeaders(config.token),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(
      redact(`${action} „${path}" n-a ajuns la GitHub: ${reason(err)}`, config.token),
    );
  }
}

/**
 * Sha-ul versiunii curente a fișierului, sau `null` dacă nu există încă.
 *
 * Spre deosebire de `putFile`, **aruncă** la o defecțiune reală (autentificare,
 * rețea, limită de cereri). Nu din neatenție: `null` înseamnă „fișierul nu e
 * acolo", iar un 401 travestit în `null` ar spune exact asta, neadevărat.
 * Suprascrierea manifestului ar pleca atunci fără sha, iar GitHub ar răspunde cu
 * o plângere despre sha lipsă — cauza reală (tokenul) ascunsă sub una derutantă.
 *
 * `putFile` prinde aruncarea și o întoarce ca valoare, deci ea nu iese din modul
 * pe drumul obișnuit.
 */
async function shaOf(config: Config, path: string): Promise<string | null> {
  const action = "căutarea versiunii pentru";
  const res = await askGitHub(config, path, action);

  // Cazul obișnuit, nu o defecțiune: dumpul zilei și scanurile noi sunt fișiere
  // care încă nu există în repo.
  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(redact(await describe(res, action, path), config.token));
  }

  const sha = textField(await readJson(res), "sha");
  if (!sha) {
    // Se întâmplă când calea e un director: atunci API-ul întoarce o listă.
    // Trece prin `redact` deși interpolează doar calea: regula e „tot ce pleacă
    // trece pe aici", iar o excepție de la ea, oricât de sigură azi, e exact
    // felul în care regula se pierde la următoarea modificare.
    throw new Error(
      redact(
        `Răspunsul GitHub pentru „${path}" n-are sha. Calea arată spre un director, ` +
          `nu spre un fișier.`,
        config.token,
      ),
    );
  }
  return sha;
}

async function contentOf(config: Config, path: string): Promise<Buffer | null> {
  const action = "citirea";
  const res = await askGitHub(config, path, action);

  // Cazul obișnuit la prima rulare: manifestul încă nu există.
  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(redact(await describe(res, action, path), config.token));
  }

  const body = await readJson(res);
  const content = textField(body, "content");
  const encoding = textField(body, "encoding");

  if (encoding !== "base64" || content === null) {
    // Două cauze duc aici și amândouă trebuie spuse, fiindcă răspunsul arată la
    // fel: calea e un director (API-ul întoarce o listă, fără câmpul `content`),
    // sau fișierul trece de 1 MB — peste prag Contents API răspunde cu
    // `encoding: "none"` și conținut gol. Ce nu se poate face aici e să
    // presupunem „gol înseamnă gol": un manifest citit ca listă vidă ar porni
    // backfill-ul de la zero și ar suprascrie evidența a tot ce e deja salvat.
    throw new Error(
      redact(
        `Răspunsul GitHub pentru „${path}" n-are conținut inline. Ori calea arată ` +
          `spre un director, ori fișierul trece de 1 MB, pragul peste care ` +
          `Contents API nu mai trimite conținutul.`,
        config.token,
      ),
    );
  }

  // GitHub rupe base64-ul în linii; `Buffer.from` ignoră spațiile albe.
  return Buffer.from(content, "base64");
}

/**
 * Conținutul unui fișier din repo, sau `null` dacă nu există.
 *
 * **Aruncă** la o defecțiune reală, din exact motivul de la `shaOf`: un
 * 401 sau o limită de cereri travestite în `null` ar spune „manifestul nu
 * există", neadevărat. Rularea ar reurca atunci tot ce e deja salvat și ar
 * scrie peste manifest evidența plecată de la zero — adică ar strica singura
 * urmă a ce s-a copiat până acum, ca răspuns la o eroare trecătoare.
 *
 * Apelantul (ruta de cron) prinde aruncarea și o scrie în evidența rulărilor.
 */
export async function getFile(path: string): Promise<Buffer | null> {
  const config = loadConfig();
  if (typeof config === "string") throw new Error(config);
  return contentOf(config, path);
}

/**
 * Scrie (sau suprascrie) un fișier în repo-ul de backup.
 *
 * Contents API cere sha-ul versiunii curente ca să suprascrie, deci se caută
 * întâi. Lipsa lui — 404 — e cazul obișnuit, nu o eroare.
 *
 * Nu aruncă niciodată: apelantul e ruta de cron, care trebuie să apuce să scrie
 * motivul în evidența rulărilor. O rulare care moare tăcut e cel mai rău caz.
 */
export async function putFile(
  path: string,
  content: Buffer,
  message: string,
): Promise<PutResult> {
  const config = loadConfig();
  if (typeof config === "string") return { ok: false, error: config };

  try {
    const sha = await shaOf(config, path);

    const res = await fetch(contentsUrl(config, path), {
      method: "PUT",
      headers: { ...apiHeaders(config.token), "Content-Type": "application/json" },
      body: JSON.stringify(putBody(message, content, sha)),
    });

    if (!res.ok) {
      return { ok: false, error: redact(await describe(res, "scrierea", path), config.token) };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: redact(`Scrierea „${path}" în repo a eșuat: ${reason(err)}`, config.token),
    };
  }
}
