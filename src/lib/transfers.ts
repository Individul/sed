import { addDays, addMonths, isSameDay, startOfDay, startOfMonth, subDays } from "date-fns";
import { todayInChisinau, toISODate, type DateRange } from "./periods";

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

/**
 * Penitenciarele partenere. Lipsesc două numere, din motive diferite: nr. 6
 * suntem noi, iar nr. 14 nu există. Constrângerea din baza de date spune
 * același lucru, ca să nu depindă de codul de aici.
 */
export const INSTITUTIONS = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18];

export function institutionLabel(n: number): string {
  return `Penitenciarul nr. ${n}`;
}

/**
 * Prima și a treia zi de luni din lună — zilele de transfer programat.
 *
 * `month` e 0-11, ca la `Date`. A treia luni e mereu prima + 14 zile, iar prima
 * cade cel târziu pe 7, deci a treia nu poate ieși din lună.
 */
export function scheduledDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // getDay(): 0 = duminică … 6 = sâmbătă. Câte zile până la prima luni.
  const offset = (8 - first.getDay()) % 7;
  const firstMonday = addDays(first, offset);
  return [firstMonday, addDays(firstMonday, 14)];
}

export function isScheduled(d: Date): boolean {
  return scheduledDays(d.getFullYear(), d.getMonth()).some((s) => isSameDay(s, d));
}

/** Ziua de transfer programat următoare; azi, dacă azi e chiar ea. */
export function nextScheduled(from: Date): Date {
  const today = startOfDay(from);
  const upcoming = scheduledDays(from.getFullYear(), from.getMonth()).find((d) => d >= today);
  if (upcoming) return upcoming;
  const next = addMonths(startOfMonth(from), 1);
  return scheduledDays(next.getFullYear(), next.getMonth())[0];
}

/**
 * Zilele programate din interval care n-au niciun rând.
 *
 * Într-un registru golul e informația importantă: o zi necompletată nu se vede
 * nicăieri altundeva. Zilele care încă n-au venit sunt sărite — o zi viitoare
 * nu poate lipsi.
 *
 * O zi lipsește abia după ce s-a încheiat, nu în timp ce se desfășoară: pe 6
 * iulie la ora 9 transferul de pe 6 iulie e în curs, iar o avertizare atunci ar
 * fi o alarmă falsă. Semnalate zilnic degeaba, avertizările ajung să fie
 * ignorate și în zilele când chiar lipsește ceva — de aceea limita e ieri.
 */
export function missingScheduled(
  range: DateRange,
  entered: { transfer_date: string }[],
  today: Date = todayInChisinau(),
): string[] {
  const have = new Set(entered.map((t) => t.transfer_date));
  const yesterday = subDays(startOfDay(today), 1);
  const last = range.to < yesterday ? range.to : yesterday;
  // Un interval care începe azi (sau mai târziu) rămâne fără nimic de verificat.
  if (last < range.from) return [];

  const out: string[] = [];
  let cursor = startOfMonth(range.from);
  while (cursor <= last) {
    for (const d of scheduledDays(cursor.getFullYear(), cursor.getMonth())) {
      if (d >= range.from && d <= last && !have.has(toISODate(d))) out.push(toISODate(d));
    }
    cursor = addMonths(cursor, 1);
  }
  return out;
}

export interface TransferCounts {
  plecati: number;
  sositi: number;
}

export interface TransferTotals extends TransferCounts {
  total: number;
  /** Sosiți minus plecați: negativ înseamnă că au plecat mai mulți decât au venit. */
  sold: number;
}

export function aggregate(rows: TransferCounts[]): TransferTotals {
  const plecati = rows.reduce((a, r) => a + (r.plecati || 0), 0);
  const sositi = rows.reduce((a, r) => a + (r.sositi || 0), 0);
  return { plecati, sositi, total: plecati + sositi, sold: sositi - plecati };
}

export interface InstitutionCounts extends TransferCounts {
  institution: number;
}

/**
 * Cât s-a mișcat cu fiecare penitenciar, în ordinea în care merită privite.
 *
 * Instituțiile fără nicio mișcare lipsesc din listă: într-o lună obișnuită ai
 * schimb cu trei-patru din cele șaisprezece, iar restul ar fi un șir de zerouri
 * care îneacă cifrele care contează.
 *
 * Ordinea e după mișcarea totală, descrescător; la egalitate după numărul
 * instituției, ca lista să nu-și schimbe ordinea de la o încărcare la alta.
 *
 * Aceeași instituție poate veni pe mai multe rânduri într-o lună — o dată la
 * transferul programat, o dată la unul urgent — deci se adună, nu se suprascriu.
 */
export function byInstitution(rows: InstitutionCounts[]): InstitutionCounts[] {
  const sums = new Map<number, InstitutionCounts>();
  for (const r of rows) {
    const acc = sums.get(r.institution) ?? { institution: r.institution, plecati: 0, sositi: 0 };
    acc.plecati += r.plecati || 0;
    acc.sositi += r.sositi || 0;
    sums.set(r.institution, acc);
  }
  return [...sums.values()]
    .filter((r) => r.plecati > 0 || r.sositi > 0)
    .sort(
      (a, b) => b.plecati + b.sositi - (a.plecati + a.sositi) || a.institution - b.institution,
    );
}

/**
 * Ziua propusă la adăugarea unui transfer.
 *
 * Ziua curentă e aproape sigur greșită: din ~30 de zile ale lunii doar două
 * sunt de transfer, deci ar trebui schimbată aproape de fiecare dată. Se
 * propune cel mai vechi gol rămas — ziua programată necompletată — iar dacă nu
 * lipsește niciuna, următoarea zi de transfer.
 *
 * `missing` vine din `missingScheduled` pe perioada afișată, deci propunerea
 * corespunde întotdeauna zilelor scrise în avertizarea de deasupra.
 */
export function defaultTransferDate(missing: string[], today: Date = todayInChisinau()): string {
  return missing[0] ?? toISODate(nextScheduled(today));
}
