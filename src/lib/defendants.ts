import { optionsFrom } from "./options";

export type Regime = "inchis" | "semiinchis";
export type DefendantStatus = "inculpat" | "condamnat";

/**
 * Categoria sub care se citește omul în registru.
 *
 * Nu se stochează: se calculează din stare și din măsura preventivă. Ținută ca
 * o coloană separată, ar fi trebuit adusă la zi de mână la fiecare schimbare a
 * măsurii — iar prima dată când cineva ar fi uitat, registrul ar fi spus două
 * lucruri deodată despre același om.
 */
export type DefendantCategory = "prevenit" | "inculpat" | "condamnat";

export interface Defendant {
  id: string;
  last_name: string;
  first_name: string;
  regime: Regime;
  established_on: string;
  court: string | null;
  case_number: string | null;
  status: DefendantStatus;
  /** Data trecerii la condamnat; null cât timp nu e condamnat. */
  convicted_on: string | null;
  /** Are măsură preventivă? De aici se citește „prevenit". */
  preventive_measure: boolean;
  /** Data măsurii, dacă e știută. Fără măsură rămâne mereu null. */
  preventive_measure_on: string | null;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const REGIME_LABEL: Record<Regime, string> = {
  inchis: "Închis",
  semiinchis: "Semiînchis",
};

/** Derivate din hartă, nu scrise a doua oară — vezi `optionsFrom`. */
export const REGIME_OPTIONS = optionsFrom(REGIME_LABEL);

export const CATEGORY_LABEL: Record<DefendantCategory, string> = {
  prevenit: "Prevenit",
  inculpat: "Inculpat",
  condamnat: "Condamnat",
};

/** Condamnarea are întâietate: odată condamnat, măsura preventivă nu-l mai descrie. */
export function categoryOf(d: Defendant): DefendantCategory {
  if (d.status === "condamnat") return "condamnat";
  return d.preventive_measure ? "prevenit" : "inculpat";
}

export interface DefendantCounts {
  /** Toți cei aflați acum în grijă — preveniți plus inculpați. */
  activi: number;
  /** Necondamnați cu măsură preventivă. */
  preveniti: number;
  /** Necondamnați fără măsură preventivă. */
  inculpati: number;
  /** Aceiași oameni ca `activi`, împărțiți după tipul de penitenciar. */
  inchis: number;
  semiinchis: number;
  condamnati: number;
  total: number;
}

/**
 * Cifrele registrului.
 *
 * Pe tip se numără **doar inculpații**: cei condamnați au ieșit din grija
 * curentă, iar amestecați în aceleași cifre ar face „câți avem acum" să crească
 * la nesfârșit, adică exact numărul pe care nimeni nu-l poate folosi.
 */
export function countDefendants(rows: Defendant[]): DefendantCounts {
  let inchis = 0;
  let semiinchis = 0;
  let preveniti = 0;
  let inculpati = 0;
  let condamnati = 0;

  for (const d of rows) {
    if (d.status === "condamnat") {
      condamnati++;
      continue;
    }
    // Aceiași oameni, numărați în două feluri: după măsură și după tip. Ambele
    // sume trebuie să dea `activi` — un test o verifică.
    if (d.preventive_measure) preveniti++;
    else inculpati++;
    if (d.regime === "inchis") inchis++;
    else semiinchis++;
  }

  return {
    activi: preveniti + inculpati,
    preveniti,
    inculpati,
    inchis,
    semiinchis,
    condamnati,
    total: rows.length,
  };
}

/** Numele întreg, cum se citește într-o listă. */
export function fullName(d: Defendant): string {
  return `${d.last_name} ${d.first_name}`;
}

/**
 * Cei aflați acum în grijă — preveniți și inculpați deopotrivă — alfabetic.
 * Registrul se citește căutând un nume, nu urmărind ordinea introducerii.
 */
export function activeDefendants(rows: Defendant[]): Defendant[] {
  return rows
    .filter((d) => d.status === "inculpat")
    .sort((a, b) => fullName(a).localeCompare(fullName(b), "ro"));
}

/** Cei trecuți la condamnat, cei mai recenți întâi. */
export function convictedDefendants(rows: Defendant[]): Defendant[] {
  return rows
    .filter((d) => d.status === "condamnat")
    .sort((a, b) => (b.convicted_on ?? "").localeCompare(a.convicted_on ?? ""));
}
