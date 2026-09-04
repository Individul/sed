import { parseISO } from "date-fns";
import { todayInChisinau } from "./periods";
import type { Task, Petition, Profile } from "./types";

/*
 * Ziua implicită e cea a Chișinăului, nu a ceasului mașinii.
 *
 * Pe Vercel serverul merge pe UTC, iar Chișinăul e înaintea lui cu două ore
 * iarna și cu trei vara. Între miezul nopții de aici și cel de la Greenwich,
 * `new Date()` întoarce încă ziua de ieri — deci fiecare socoteală de termen ar
 * fi greșită cu o zi în fereastra aceea: banda ar rămâne galbenă în dimineața
 * termenului și portocalie în dimineața de după.
 *
 * Stă în valorile implicite, nu la apeluri: așa e corect și pentru apelurile
 * care se vor scrie de-acum înainte. Cine dă explicit o dată — testele, în
 * primul rând — n-o simte deloc.
 */

export interface ModuleStats {
  total: number;
  dueSoon: number;
  overdue: number;
}
export interface TaskStats extends ModuleStats {
  active: number;
  done: number;
  /** Sarcini care depind de un răspuns extern — nu intră în restanțe. */
  waiting: number;
}
export interface PetitionStats extends ModuleStats {
  open: number;
  solved: number;
}

/**
 * Câmpurile din care ies cifrele — atât, nu tot rândul.
 *
 * Pagina de start cere din baza de date exact aceste coloane (`getTaskCounts`,
 * `getPetitionCounts` din lib/queries), fiindcă restul nu se afișează acolo.
 * Tipul îngust e paznicul acelei interogări: dacă mâine cineva adaugă în
 * `taskStats` o citire de `priority`, compilarea cade. Cu `Task` întreg în
 * semnătură n-ar cădea — s-ar număra tăcut, la nesfârșit, pe un câmp care
 * sosește mereu `undefined`.
 *
 * Semnăturile rămân totuși deschise: TypeScript compară structura, nu numele,
 * deci un `Task` întreg intră neschimbat pe unde intra și înainte.
 */
export type TaskCounts = Pick<Task, "status" | "due_date">;
export type PetitionCounts = Pick<Petition, "status" | "response_deadline">;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Clasifică un termen față de „azi”: restant, scadent în ≤7 zile, sau nici una. */
function classify(deadline: string | null, today: Date): "overdue" | "soon" | "none" {
  if (!deadline) return "none";
  const start = startOfDay(today);
  const due = startOfDay(parseISO(deadline));
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 7) return "soon";
  return "none";
}

export function taskStats(tasks: TaskCounts[], today: Date = todayInChisinau()): TaskStats {
  let active = 0;
  let done = 0;
  let waiting = 0;
  let dueSoon = 0;
  let overdue = 0;
  for (const t of tasks) {
    if (t.status === "done") {
      done++;
      continue;
    }
    active++;
    // Cât depinde de instanță, termenul nu curge: nici restantă, nici scadentă.
    if (t.status === "waiting") {
      waiting++;
      continue;
    }
    const c = classify(t.due_date, today);
    if (c === "overdue") overdue++;
    else if (c === "soon") dueSoon++;
  }
  return { total: tasks.length, active, done, waiting, dueSoon, overdue };
}

export interface AssigneeCount {
  id: string | null;
  name: string;
  count: number;
  overdue: number;
}

const UNASSIGNED = "Neatribuit";

/**
 * O sarcină e restantă dacă are termen trecut și nu e finalizată — dar nu și
 * cât timp așteaptă răspuns extern: acolo întârzierea nu e a responsabilului.
 */
export function isTaskOverdue(task: TaskCounts, today: Date = todayInChisinau()): boolean {
  if (task.status === "done" || task.status === "waiting") return false;
  return classify(task.due_date, today) === "overdue";
}

/**
 * Scadentă în următoarele 7 zile — perechea lui `isTaskOverdue`.
 *
 * Un singur predicat per cifră: cardul de pe pagina de start, filtrul listei
 * și vederea rapidă trebuie să numere identic. Bugul „8 restanțe aici, 1
 * dincolo" a venit exact din recalculări private ale aceleiași întrebări.
 */
export function isTaskDueSoon(task: TaskCounts, today: Date = todayInChisinau()): boolean {
  if (task.status === "done" || task.status === "waiting") return false;
  return classify(task.due_date, today) === "soon";
}

/** O petiție e restantă dacă are termen de răspuns trecut și e încă în examinare. */
export function isPetitionOverdue(petition: PetitionCounts, today: Date = todayInChisinau()): boolean {
  return (
    petition.status === "in_examinare" &&
    classify(petition.response_deadline, today) === "overdue"
  );
}

/**
 * Grupează elementele pe responsabil, descrescător după număr (alfabetic la
 * egalitate). „Neatribuit” — inclusiv responsabilii care nu mai există în
 * `profiles` — apare mereu la final. Cu `isOverdue` se numără separat și câte
 * dintre elementele fiecăruia sunt restante.
 */
export interface AssigneeGroup<T> {
  id: string | null;
  name: string;
  items: T[];
}

/**
 * Grupează elementele pe responsabil, păstrând elementele, nu doar numărul lor.
 *
 * Astfel fiecare grup poate fi trecut prin aceeași funcție de statistici ca
 * totalul cardului: cifrele per persoană și cele de sus vin din același calcul,
 * deci nu se pot contrazice la prima schimbare de regulă.
 *
 * Ordinea: descrescător după număr, alfabetic la egalitate, „Neatribuit” la
 * final — inclusiv responsabilii care nu mai există în `profiles`.
 */
export function groupByAssignee<T extends { assignee_id: string | null }>(
  items: T[],
  profiles: Profile[],
): AssigneeGroup<T>[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const groups = new Map<string | null, T[]>();

  for (const item of items) {
    const key = item.assignee_id && byId.has(item.assignee_id) ? item.assignee_id : null;
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  const rows: AssigneeGroup<T>[] = [...groups].map(([id, list]) => ({
    id,
    name: id ? byId.get(id)!.full_name ?? "(fără nume)" : UNASSIGNED,
    items: list,
  }));

  return rows.sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return b.items.length - a.items.length || a.name.localeCompare(b.name, "ro");
  });
}

export function countsByAssignee<T extends { assignee_id: string | null }>(
  items: T[],
  profiles: Profile[],
  isOverdue?: (item: T) => boolean,
): AssigneeCount[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const counts = new Map<string | null, { count: number; overdue: number }>();

  for (const item of items) {
    const key = item.assignee_id && byId.has(item.assignee_id) ? item.assignee_id : null;
    const row = counts.get(key) ?? { count: 0, overdue: 0 };
    row.count++;
    if (isOverdue?.(item)) row.overdue++;
    counts.set(key, row);
  }

  const rows: AssigneeCount[] = [...counts].map(([id, { count, overdue }]) => ({
    id,
    name: id ? byId.get(id)!.full_name ?? "(fără nume)" : UNASSIGNED,
    count,
    overdue,
  }));

  return rows.sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return b.count - a.count || a.name.localeCompare(b.name, "ro");
  });
}

export function petitionStats(petitions: PetitionCounts[], today: Date = todayInChisinau()): PetitionStats {
  let open = 0;
  let solved = 0;
  let dueSoon = 0;
  let overdue = 0;
  for (const p of petitions) {
    if (p.status !== "in_examinare") {
      if (p.status === "solutionat") solved++;
      continue;
    }
    open++;
    const c = classify(p.response_deadline, today);
    if (c === "overdue") overdue++;
    else if (c === "soon") dueSoon++;
  }
  return { total: petitions.length, open, solved, dueSoon, overdue };
}
