import { addDays, parseISO } from "date-fns";
import { optionsFrom } from "@/lib/options";
import type { PetitionStatus, PetitionerType } from "@/lib/types";

import { PETITION_STATUS_LABEL } from "@/lib/status-labels";
// Reluat, nu rescris: aceleași cuvinte le arată și căutarea.
export const STATUS_LABEL = PETITION_STATUS_LABEL;

export const STATUS_DOT: Record<PetitionStatus, string> = {
  in_examinare: "bg-amber-500",
  solutionat: "bg-green-600",
};

/** Derivate din hărți, nu scrise a doua oară — vezi `optionsFrom`. */
export const STATUS_OPTIONS = optionsFrom(STATUS_LABEL);

export const PETITIONER_LABEL: Record<PetitionerType, string> = {
  detinut: "Deținut",
  avocat: "Avocat",
  civil: "Persoană civilă",
};

export const PETITIONER_OPTIONS = optionsFrom(PETITIONER_LABEL);

// Termen = data înregistrării + 27 de zile (a 27-a zi calendaristică = ultima).
export function deadlineFrom(received: string): Date | null {
  if (!received) return null;
  try {
    return addDays(parseISO(received), 27);
  } catch {
    return null;
  }
}

// Zile rămase până la termen (negativ = restant). Se raportează la începutul zilei.
export function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = parseISO(deadline);
  return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
}

// Normalizarea pentru căutare stă în @/lib/text; se re-exportă aici
// pentru importatorii existenți din modulul de petiții.
export { fold } from "@/lib/text";
