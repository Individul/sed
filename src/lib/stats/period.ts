/**
 * Ghicește perioada raportului din numele fișierului. E doar o propunere:
 * utilizatorul confirmă sau schimbă data și tipul în interfață.
 */

export type PeriodType = "saptamanal" | "lunar";

export interface PeriodGuess {
  /** Data de referință a raportului, ISO `yyyy-mm-dd`. */
  date: string;
  type: PeriodType;
}

/** Ordinea contează: indexul + 1 e numărul lunii. */
const MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

/** Semnele diacritice rămase după descompunerea NFD. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** `dd.mm.yyyy` — global, ca să putem sări peste datele imposibile. */
const EXPLICIT_DATE = /(\d{2})\.(\d{2})\.(\d{4})(?!\d)/g;

/**
 * `<lună> <an>`. Anul trebuie să stea lipit de lună (cel mult trei semne de
 * punctuație între ele), altfel „iunie” din orice titlu ar înghiți primul an
 * care apare mai încolo. `\b` ține luna cuvânt întreg: „premai 2026” nu e mai.
 */
const MONTH_YEAR = new RegExp(
  `\\b(${MONTHS.join("|")})\\b[^0-9a-z]{0,3}((?:19|20)\\d{2})\\b`,
);

/**
 * Minuscule, fără diacritice și cu `_` transformat în spațiu — underscore-ul e
 * separator în numele reale („Tabel_iulie_2026”), dar pentru regex e literă,
 * așa că ar strica limitele de cuvânt.
 */
function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/_/g, " ")
    .toLowerCase();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Formatează data doar dacă ziua chiar există (31.04 sau 29.02.2025 → null). */
function isoDate(year: number, month: number, day: number): string | null {
  const utc = new Date(Date.UTC(year, month - 1, day));
  const real =
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day;
  return real ? `${year}-${pad(month)}-${pad(day)}` : null;
}

function fromExplicitDate(text: string): string | null {
  EXPLICIT_DATE.lastIndex = 0;
  for (let m = EXPLICIT_DATE.exec(text); m; m = EXPLICIT_DATE.exec(text)) {
    // O cifră lipită în față înseamnă alt număr („Anexa 123.06.2026”).
    const before = m.index > 0 ? text[m.index - 1] : "";
    if (/\d/.test(before)) continue;

    const date = isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
    if (date) return date;
  }
  return null;
}

function fromMonthName(text: string): string | null {
  const m = MONTH_YEAR.exec(text);
  if (!m) return null;
  return isoDate(Number(m[2]), MONTHS.indexOf(m[1]) + 1, 1);
}

/**
 * `01.06.2026_r_lunar.xlsx` → 2026-06-01, `Tabel … iunie 2026.xlsx` →
 * 2026-06-01, iar un nume fără dată (doar anul, de pildă) → `null`.
 * Tipul e mereu „lunar”: numele fișierelor nu spun nimic despre el.
 */
export function guessPeriod(fileName: string): PeriodGuess | null {
  const text = normalize(fileName);
  const date = fromExplicitDate(text) ?? fromMonthName(text);
  return date === null ? null : { date, type: "lunar" };
}
