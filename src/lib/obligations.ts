import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  getDate,
  getDay,
  lastDayOfMonth,
  startOfDay,
  startOfMonth,
  subMonths,
  subWeeks,
} from "date-fns";

import { parseISODate, todayInChisinau, toISODate } from "./periods";

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

export type ObligationKind = "lunar_zi" | "lunar_ultima_zi" | "saptamanal";

export interface Obligation {
  id: string;
  title: string;
  recipient: string;
  kind: ObligationKind;
  /** Pentru `lunar_zi`: ziua din lună (1–31). */
  day_of_month: number | null;
  /** Pentru `saptamanal`: 0 = duminică … 5 = vineri … 6 = sâmbătă. */
  weekday: number | null;
  /** De când ține evidența; termenele dinaintea ei nu există pentru ea. */
  starts_on: string;
  assignee_id: string | null;
  active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * Termenul dintr-o lună anume.
 *
 * Ziua se retează la lungimea lunii: „până la data de 30" în februarie e ultima
 * zi a lui februarie, nu o dată inexistentă. Fără retezare, `new Date(2026, 1,
 * 30)` ar aluneca în martie — adică termenul s-ar muta liniștit cu două zile
 * după lună, exact în luna în care e cel mai strâns.
 */
function monthlyDue(o: Obligation, month: Date): Date {
  const last = lastDayOfMonth(month);
  if (o.kind === "lunar_ultima_zi") return last;
  const wanted = o.day_of_month ?? 1;
  return new Date(month.getFullYear(), month.getMonth(), Math.min(wanted, getDate(last)));
}

/** Ziua din săptămâna lui `ref` care corespunde zilei cerute. */
function weeklyDue(o: Obligation, ref: Date): Date {
  const wanted = o.weekday ?? 5;
  const d = startOfDay(ref);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((wanted - getDay(d) + 7) % 7));
}

/** Primul termen din sau de după `from`. */
function dueOnOrAfter(o: Obligation, from: Date): Date {
  const f = startOfDay(from);
  if (o.kind === "saptamanal") return weeklyDue(o, f);
  const thisMonth = monthlyDue(o, startOfMonth(f));
  return thisMonth >= f ? thisMonth : monthlyDue(o, addMonths(startOfMonth(f), 1));
}

/** Cel mai recent termen care a venit deja (azi inclusiv). */
export function lastDue(o: Obligation, today: Date = todayInChisinau()): Date {
  const t = startOfDay(today);
  if (o.kind === "saptamanal") {
    const thisWeek = weeklyDue(o, subWeeks(t, 1));
    const candidates = [thisWeek, addWeeks(thisWeek, 1), addWeeks(thisWeek, 2)];
    return candidates.filter((d) => d <= t).at(-1)!;
  }
  const thisMonth = monthlyDue(o, startOfMonth(t));
  return thisMonth <= t ? thisMonth : monthlyDue(o, subMonths(startOfMonth(t), 1));
}

/** Primul termen care n-a venit încă. */
export function nextDue(o: Obligation, today: Date = todayInChisinau()): Date {
  const t = startOfDay(today);
  if (o.kind === "saptamanal") {
    const d = weeklyDue(o, t);
    return d > t ? d : addWeeks(d, 1);
  }
  const thisMonth = monthlyDue(o, startOfMonth(t));
  return thisMonth > t ? thisMonth : monthlyDue(o, addMonths(startOfMonth(t), 1));
}

export interface Pending {
  obligation: Obligation;
  /** Termenul care contează acum (AAAA-LL-ZZ). */
  due: string;
  /** Zile până la termen; negativ înseamnă că a trecut. */
  days: number;
  overdue: boolean;
}

/**
 * Termenul care contează acum pentru o obligație: primul termen nebifat.
 *
 * Dacă cel mai recent termen trecut n-a fost bifat, el rămâne cel care contează
 * — restanța nu dispare pentru că a venit luna următoare.
 *
 * De la el se merge înainte peste TOATE termenele deja bifate, nu doar unul.
 * Bifarea din timp e fluxul normal — raportul cu termen pe 20 se trimite pe
 * 17-19, deci bifa cade pe un termen viitor. Fără mersul înainte, bifa aceea
 * era invizibilă: rândul rămânea neschimbat, banda continua să bată la cap,
 * iar un click greșit marca tăcut un raport netrimis ca trimis, fără nicio
 * urmă pe ecran. Acum orice bifă mută rândul — se vede și bifa bună, și
 * greșeala.
 *
 * În urmă se privește o singură apariție. O dare de seamă nebifată acum șase
 * luni nu mai e o acțiune de făcut, ci un gol în evidență; ținută la vedere, ar
 * împinge afară exact termenul de săptămâna asta.
 */
export function pendingFor(
  o: Obligation,
  completed: Set<string>,
  today: Date = todayInChisinau(),
): Pending {
  const start = parseISODate(o.starts_on);
  const last = lastDue(o, today);
  // Un termen dinaintea începutului evidenței n-a fost niciodată al ei: nu e o
  // restanță, ci o lună despre care obligația n-avea ce spune.
  let due = last < start ? dueOnOrAfter(o, start) : last;
  // Bifele sunt finite, iar fiecare pas merge strict înainte, deci bucla se
  // oprește cel târziu la primul termen fără bifă.
  while (completed.has(toISODate(due))) {
    due = dueOnOrAfter(o, addDays(due, 1));
  }
  const days = differenceInCalendarDays(due, startOfDay(today));
  return { obligation: o, due: toISODate(due), days, overdue: days < 0 };
}

/**
 * Cu cât timp înainte începe să fie arătată o obligație.
 *
 * Diferă după ritm dintr-un motiv practic: cu cinci zile de preaviz, o obligație
 * săptămânală ar fi vizibilă în fiecare zi lucrătoare, iar o bandă care stă
 * mereu pe ecran devine tapet — se citește la fel de puțin ca nimic.
 */
export function leadDays(kind: ObligationKind): number {
  return kind === "saptamanal" ? 2 : 5;
}

/** Se arată la vedere doar ce e restant sau aproape de termen. */
export function needsAttention(p: Pending): boolean {
  return p.overdue || p.days <= leadDays(p.obligation.kind);
}

/**
 * Cât de urgentă e cea mai urgentă obligație din listă.
 *
 * Trei trepte, nu două, fiindcă ziua termenului nu e nici „mai e timp”, nici
 * „ai întârziat” — e singura zi în care lucrul chiar trebuie făcut, iar dacă
 * arată la fel ca „peste cinci zile”, exact ea trece neobservată.
 *
 * Banda ia treapta celui mai urgent rând: dacă e ceva restant, aia e știrea,
 * chiar dacă mai e și ceva scadent azi.
 */
export type ObligationUrgency = "restant" | "astazi" | "apropiat";

export function bandUrgency(items: Pending[]): ObligationUrgency {
  if (items.some((p) => p.overdue)) return "restant";
  if (items.some((p) => p.days === 0)) return "astazi";
  return "apropiat";
}

/** Restanțele primele, apoi după termen; la egalitate, ordinea din listă. */
export function sortPending(items: Pending[]): Pending[] {
  return [...items].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      a.due.localeCompare(b.due) ||
      a.obligation.position - b.obligation.position,
  );
}
