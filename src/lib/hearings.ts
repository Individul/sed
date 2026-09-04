import { eachDayOfInterval, isWeekend } from "date-fns";

import { toISODate, type DateRange } from "./periods";

/** Cifrele introduse manual pentru o zi; totalurile se deduc din ele. */
export interface HearingCounts {
  tc_petrecute: number;
  tc_amanate: number;
  ij_petrecute: number;
  ij_amanate: number;
}

export interface Hearing extends HearingCounts {
  id: string;
  session_date: string;
  tc_total: number;
  ij_total: number;
  total_general: number;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Toți indicatorii, din cele patru cifre introduse.
 *
 *   total pe categorie = petrecute + amânate
 *   total general      = teleconferință + instanță
 */
export interface Indicators extends HearingCounts {
  tc_total: number;
  ij_total: number;
  total: number;
  petrecute: number;
  amanate: number;
}

export function computeIndicators(c: HearingCounts): Indicators {
  const tc_total = c.tc_petrecute + c.tc_amanate;
  const ij_total = c.ij_petrecute + c.ij_amanate;
  return {
    ...c,
    tc_total,
    ij_total,
    total: tc_total + ij_total,
    petrecute: c.tc_petrecute + c.ij_petrecute,
    amanate: c.tc_amanate + c.ij_amanate,
  };
}

const EMPTY: HearingCounts = {
  tc_petrecute: 0,
  tc_amanate: 0,
  ij_petrecute: 0,
  ij_amanate: 0,
};

/** Adună zilele câmp cu câmp, apoi deduce indicatorii din suma lor. */
export function aggregate(rows: HearingCounts[]): Indicators {
  return computeIndicators(
    rows.reduce<HearingCounts>(
      (acc, r) => ({
        tc_petrecute: acc.tc_petrecute + (r.tc_petrecute || 0),
        tc_amanate: acc.tc_amanate + (r.tc_amanate || 0),
        ij_petrecute: acc.ij_petrecute + (r.ij_petrecute || 0),
        ij_amanate: acc.ij_amanate + (r.ij_amanate || 0),
      }),
      { ...EMPTY },
    ),
  );
}

/**
 * Zilele lucrătoare din interval care n-au nicio înregistrare.
 *
 * Într-un registru oficial golul e informația importantă: o zi necompletată nu
 * se vede nicăieri altundeva până la raportarea lunară. Sâmbetele și duminicile
 * sunt excluse — nu se țin ședințe — la fel și zilele care încă n-au venit,
 * fiindcă o zi viitoare nu poate lipsi.
 *
 * Sărbătorile legale nu-i sunt cunoscute aplicației, deci vor apărea ca lipsă.
 */
export function missingWorkdays(
  range: DateRange,
  entered: { session_date: string }[],
  today: Date = new Date(),
): string[] {
  const have = new Set(entered.map((h) => h.session_date));
  const last = range.to < today ? range.to : today;
  if (last < range.from) return [];
  return eachDayOfInterval({ start: range.from, end: last })
    .filter((d) => !isWeekend(d))
    .map(toISODate)
    .filter((iso) => !have.has(iso));
}
