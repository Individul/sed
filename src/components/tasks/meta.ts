import { optionsFrom } from "@/lib/options";
import type { TaskPriority, TaskStatus } from "@/lib/types";

/**
 * Eticheta fiecărei stări, într-un singur loc.
 *
 * `Record<TaskStatus, string>` nu e decorativ: obligă compilatorul să ceară o
 * etichetă pentru fiecare stare din tip. Fără el, adăugarea stării „în
 * așteptare" a lăsat în urmă trei liste scrise de mână, fără ca nimic să se
 * plângă — puteai seta starea din formular, dar nu filtra după ea, iar în
 * rezumat cifrele nu se mai închideau (17 + 1 + 9 din 41).
 *
 * Ordinea e cea a fluxului de lucru, nu alfabetică. `Object.entries` o
 * păstrează, deci listele derivate ies în aceeași ordine.
 */
export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "De făcut",
  in_progress: "În lucru",
  waiting: "În așteptare",
  done: "Finalizat",
};

/** Aceleași stări, în forma cerută de listele derulante — derivată, nu scrisă. */
export const STATUS_OPTIONS = optionsFrom(STATUS_LABEL);

/**
 * Culoarea punctului fiecărei stări — tot într-un singur loc.
 *
 * Înainte fiecare componentă își alegea nuanța ei și deja se despărțiseră:
 * vederile rapide foloseau sky/emerald, rezumatul și tabelul blue/green.
 * Aceeași stare, două culori pe același ecran.
 */
export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  waiting: "bg-violet-500",
  done: "bg-green-500",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Scăzută",
  medium: "Medie",
  high: "Ridicată",
};

export const PRIORITY_OPTIONS = optionsFrom(PRIORITY_LABEL);
