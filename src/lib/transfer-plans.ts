import { startOfDay, startOfMonth, subMonths } from "date-fns";

import { nextScheduled, scheduledDays } from "./transfers";
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
import type { Court } from "./courts";

/** Ce anume cere transferul. Vezi migrarea 0027. */
export type TransferBasis = "sedinta" | "decizie";

export interface TransferPlan {
  id: string;
  last_name: string;
  first_name: string;
  basis: TransferBasis;
  /** Lipsește când temeiul e o decizie venită din afara unei judecătorii. */
  court: Court | null;
  /** Penitenciarul unde trebuie dus omul. */
  institution: number;
  /** Completată doar la temei „ședință". */
  hearing_date: string | null;
  /** Data parvenirii deciziei; completată doar la temei „decizie". */
  decision_date: string | null;
  done: boolean;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ziua de transfer pentru o ședință: cea mai apropiată zi programată dinaintea
 * ședinței care încă n-a trecut.
 *
 * „Cea mai apropiată", nu „prima disponibilă": mutat cu șase săptămâni înainte,
 * omul ar aștepta degeaba la altă instituție. Transferul se face în ultimul
 * moment posibil.
 *
 * `null` înseamnă că nu mai există zi de transfer înainte de ședință — cazul în
 * care instanța trebuie înștiințată că nu poate fi pusă în executare.
 */
export function transferDayFor(hearing: Date, today: Date = todayInChisinau()): string | null {
  const h = startOfDay(hearing);
  const from = startOfDay(today);

  // Între a treia luni a unei luni și prima luni a următoarei pot trece ~3
  // săptămâni, deci luna precedentă intră mereu în calcul.
  const month = startOfMonth(h);
  const candidates = [subMonths(month, 1), month].flatMap((m) =>
    scheduledDays(m.getFullYear(), m.getMonth()),
  );

  const usable = candidates.filter((d) => d < h && d >= from);
  return usable.length ? toISODate(usable[usable.length - 1]) : null;
}

/**
 * Ziua de transfer pentru o decizie: prima zi programată de la parvenirea ei.
 *
 * Regula e răsturnată față de ședințe. Acolo transferul se face înaintea unui
 * termen, deci în ultimul moment posibil, și se poate întâmpla să nu mai existe
 * niciun moment. Aici decizia e deja luată: se execută la prima ocazie, iar
 * ocazie există întotdeauna — de aceea nu întoarce niciodată `null`.
 *
 * Se pornește de la ziua mai târzie dintre parvenire și azi. O decizie sosită
 * luna trecută și rămasă neexecutată nu trimite omul la o zi care a trecut: se
 * mută la următoarea, ca și o ședință amânată.
 */
export function transferDayForDecision(
  decision: Date,
  today: Date = todayInChisinau(),
): string {
  const d = startOfDay(decision);
  const t = startOfDay(today);
  return toISODate(nextScheduled(d > t ? d : t));
}

/** Data de care atârnă transferul, oricare ar fi temeiul. */
export function planDate(plan: TransferPlan): string | null {
  return plan.basis === "decizie" ? plan.decision_date : plan.hearing_date;
}

/**
 * Ziua de transfer a unei planificări, după temeiul ei.
 *
 * `null` înseamnă „de înștiințat instanța" — dar numai la ședințe; la decizii
 * apare doar dacă data lipsește cu totul, ceea ce baza nu îngăduie.
 */
export function planTransferDay(
  plan: TransferPlan,
  today: Date = todayInChisinau(),
): string | null {
  const d = planDate(plan);
  if (!d) return null;
  return plan.basis === "decizie"
    ? transferDayForDecision(parseISODate(d), today)
    : transferDayFor(parseISODate(d), today);
}

export interface PlanGroup {
  /** Ziua de transfer; `null` = de înștiințat instanța. */
  day: string | null;
  plans: TransferPlan[];
}

/**
 * Grupează planurile neîncheiate pe ziua de transfer calculată, cronologic.
 * Cele fără zi posibilă ies primele: sunt singurele care cer o acțiune azi.
 */
export function groupByTransferDay(
  plans: TransferPlan[],
  today: Date = todayInChisinau(),
): PlanGroup[] {
  const byDay = new Map<string | null, TransferPlan[]>();

  for (const p of plans) {
    if (p.done) continue;
    const day = planTransferDay(p, today);
    const list = byDay.get(day);
    if (list) list.push(p);
    else byDay.set(day, [p]);
  }

  const groups = [...byDay].map(([day, list]) => ({
    day,
    plans: [...list].sort((a, b) => (planDate(a) ?? "").localeCompare(planDate(b) ?? "")),
  }));

  return groups.sort((a, b) => {
    if (a.day === null) return -1;
    if (b.day === null) return 1;
    return a.day.localeCompare(b.day);
  });
}
