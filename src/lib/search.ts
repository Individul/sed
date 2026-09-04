import { fold } from "./text";
import type { Defendant } from "./defendants";
import type { TransferPlan } from "./transfer-plans";
import type { Petition, Task } from "./types";
import { PETITION_STATUS_LABEL, TASK_STATUS_LABEL } from "./status-labels";
import { institutionLabel } from "./transfers";

/**
 * Căutare peste toate registrele.
 *
 * Rostul ei nu e „să găsești mai repede o petiție" — pentru asta fiecare modul
 * are deja filtrul lui. Rostul e că același om e împrăștiat prin patru
 * registre: poate fi deodată titlu de sarcină, petiționar, om pe lista de
 * transfer și prevenit. Întrebarea care se pune de fapt în secție e „ce avem pe
 * X?", iar până acum ea cerea patru căutări și o ținere de minte.
 *
 * Se caută în memorie, nu în baza de date, fiindcă toate registrele la un loc
 * fac în jur de 400 de rânduri. Nu e o scurtătură: `fold` ignoră diacriticele,
 * deci „Tiganciuc" găsește „Țiganciuc", ceea ce un `ilike` din Postgres n-ar
 * face fără extensia `unaccent` și o migrare. Tiparul ține câți ani cresc
 * registrele cu câteva sute pe an; peste vreo cinci mii de rânduri, căutarea va
 * trebui mutată în bază.
 */

export type SearchKind = "sarcina" | "petitie" | "transfer" | "prevenit";

/** Numele culorilor deja folosite în module; UI-ul le traduce în clase. */
export type StateTone = "slate" | "blue" | "violet" | "amber" | "green";

const TON_SARCINA: Record<Task["status"], StateTone> = {
  todo: "slate",
  in_progress: "blue",
  waiting: "violet",
  done: "green",
};

const TON_PETITIE: Record<Petition["status"], StateTone> = {
  in_examinare: "amber",
  solutionat: "green",
};

export interface SearchHit {
  kind: SearchKind;
  id: string;
  /** Rândul de sus: numele sub care se recunoaște. */
  title: string;
  /** Rândul de jos: eticheta, obiectul, instanța — ce deosebește două rânduri asemenea. */
  detail: string | null;
  /**
   * Starea, cu numele pe care i-l dă chiar registrul.
   *
   * Ținută deoparte de `detail`, nu lipită la coada lui: e singurul lucru care
   * se citește la fel la toate rândurile, deci merită un loc fix pe care ochiul
   * să-l poată coborî pe verticală. Amestecată în text, ar fi trebuit căutată
   * de fiecare dată la alt capăt de frază.
   */
  state: string | null;
  /**
   * Culoarea însemnului de stare, luată din modulul de unde vine rândul.
   *
   * Nu e o paletă nouă: sarcinile își colorează deja stările cu slate/albastru/
   * violet/verde, petițiile cu chihlimbariu/verde. Rezultatul căutării arată la
   * fel ca registrul din care vine, deci nu cere învățat un al doilea cod.
   */
  tone: StateTone;
  /** Terminat — rândul se stinge, ca ochiul să treacă peste el. */
  finished: boolean;
  href: string;
}

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  hits: SearchHit[];
  /** Câte au mai rămas nearătate, peste `LIMIT_PE_GRUP`. */
  more: number;
}

/**
 * Sub două litere nu se caută: o singură literă potrivește aproape orice, deci
 * ar întoarce tot registrul sub formă de „rezultate".
 */
export const MIN_QUERY = 2;

/** Cât se arată dintr-un grup. Restul se numără, ca omul să știe că mai sunt. */
export const LIMIT_PE_GRUP = 6;

const LABEL: Record<SearchKind, string> = {
  sarcina: "Sarcini",
  petitie: "Petiții",
  transfer: "Planificare transferuri",
  prevenit: "Preveniți și inculpați",
};

/** Ordinea grupurilor: cele cu cel mai des căutat conținut întâi. */
const ORDINE: SearchKind[] = ["sarcina", "petitie", "transfer", "prevenit"];

interface Candidat {
  hit: SearchHit;
  /** Textul în care se caută, deja pliat — nu se pliază la fiecare tastă. */
  haystack: string;
}

function candidat(hit: SearchHit, parti: (string | null | undefined)[]): Candidat {
  return { hit, haystack: fold(parti.filter(Boolean).join(" ")) };
}

/** Rândul de jos, din bucățile care există. `null` când n-a rămas niciuna. */
function detaliu(parti: (string | null | undefined)[]): string | null {
  const p = parti.filter((x): x is string => Boolean(x));
  return p.length ? p.join(" · ") : null;
}

export type TaskRow = Pick<Task, "id" | "title" | "description" | "status" | "tags">;
export type PetitionRow = Pick<Petition, "id" | "number" | "petitioner" | "subject" | "status">;
export type PlanRow = Pick<
  TransferPlan,
  "id" | "last_name" | "first_name" | "court" | "institution" | "note" | "done"
>;
export type DefendantRow = Pick<
  Defendant,
  "id" | "last_name" | "first_name" | "court" | "case_number" | "status" | "preventive_measure"
>;

export interface SearchData {
  tasks: TaskRow[];
  petitions: PetitionRow[];
  plans: PlanRow[];
  defendants: DefendantRow[];
}

function candidati(data: SearchData): Candidat[] {
  const out: Candidat[] = [];

  for (const t of data.tasks) {
    /*
     * Esența sarcinii stă în etichete, nu în titlu.
     *
     * Titlul e numele deținutului — la fel la toate sarcinile aceluiași om, deci
     * trei rânduri cu același nume n-ar spune cu ce se deosebesc. Eticheta
     * („audiență", „art. 92") e chiar lucrul de făcut, adică ce caută ochiul,
     * exact ca obiectul la petiții.
     *
     * Se caută și în ele: cine scrie „audiență" vrea sarcinile audienței, nu doar
     * petițiile.
     */
    const etichete = (t.tags ?? []).map((g) => g.name);
    out.push(
      candidat(
        {
          kind: "sarcina",
          id: t.id,
          title: t.title,
          detail: detaliu(etichete),
          state: TASK_STATUS_LABEL[t.status],
          tone: TON_SARCINA[t.status],
          finished: t.status === "done",
          href: `/tasks/${t.id}`,
        },
        [t.title, t.description, ...etichete],
      ),
    );
  }

  for (const p of data.petitions) {
    out.push(
      candidat(
        {
          kind: "petitie",
          id: p.id,
          title: `${p.number} — ${p.petitioner}`,
          detail: p.subject || null,
          state: PETITION_STATUS_LABEL[p.status],
          tone: TON_PETITIE[p.status],
          finished: p.status === "solutionat",
          // Se deschide chiar petiția, nu registrul; vezi `notificationHref`.
          href: `/petitii?petitie=${p.id}`,
        },
        [p.number, p.petitioner, p.subject],
      ),
    );
  }

  for (const p of data.plans) {
    if (p.done) continue; // încheiate: ies din lista de lucru
    out.push(
      candidat(
        {
          kind: "transfer",
          id: p.id,
          title: `${p.last_name} ${p.first_name}`,
          detail: detaliu([p.court, institutionLabel(p.institution)]),
          // Planificările încheiate nici nu ajung aici, deci n-au ce stare arăta.
          state: null,
          tone: "slate",
          finished: false,
          href: "/transferuri/planificare",
        },
        [p.last_name, p.first_name, p.court, p.note],
      ),
    );
  }

  for (const d of data.defendants) {
    const categorie =
      d.status === "condamnat" ? "condamnat" : d.preventive_measure ? "prevenit" : "inculpat";
    out.push(
      candidat(
        {
          kind: "prevenit",
          id: d.id,
          title: `${d.last_name} ${d.first_name}`,
          detail: detaliu([d.court, d.case_number ? `dosar ${d.case_number}` : null]),
          // Categoria e starea acestui registru: prevenit, inculpat, condamnat.
          state: categorie.charAt(0).toUpperCase() + categorie.slice(1),
          // Chihlimbariu pentru cel cu măsură preventivă, ca „în examinare" la
          // petiții: e cazul care cere atenție. Verde pentru condamnat: a ieșit
          // din grija curentă, ca o sarcină finalizată.
          tone: categorie === "prevenit" ? "amber" : categorie === "condamnat" ? "green" : "slate",
          finished: d.status === "condamnat",
          href: "/inculpati",
        },
        [d.last_name, d.first_name, d.court, d.case_number],
      ),
    );
  }

  return out;
}

/** Grupurile cu rezultate, în ordine fixă. Grupurile goale nu apar. */
export function search(query: string, data: SearchData): SearchGroup[] {
  const q = fold(query.trim());
  if (q.length < MIN_QUERY) return [];

  const gasite = candidati(data).filter((c) => c.haystack.includes(q));

  return ORDINE.map((kind) => {
    const toate = gasite.filter((c) => c.hit.kind === kind).map((c) => c.hit);
    return {
      kind,
      label: LABEL[kind],
      hits: toate.slice(0, LIMIT_PE_GRUP),
      more: Math.max(0, toate.length - LIMIT_PE_GRUP),
    };
  }).filter((g) => g.hits.length > 0);
}

/** Câte rezultate în total, pentru mesajul „N rezultate". */
export function countHits(groups: SearchGroup[]): number {
  return groups.reduce((n, g) => n + g.hits.length + g.more, 0);
}
