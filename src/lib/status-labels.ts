import type { PetitionStatus, TaskStatus } from "./types";

/**
 * Numele stărilor, într-un singur loc.
 *
 * Erau scrise în fișierele de componente ale fiecărui modul. Căutarea le arată
 * și ea, iar copiate acolo ar fi ajuns, la prima redenumire, să spună altceva
 * decât registrul din care vin — un rezultat „În lucru" pentru o sarcină pe care
 * lista o numește altfel. Culorile rămân la module: acolo sunt UI, aici e text.
 */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "De făcut",
  in_progress: "În lucru",
  waiting: "În așteptare",
  done: "Finalizat",
};

export const PETITION_STATUS_LABEL: Record<PetitionStatus, string> = {
  in_examinare: "În examinare",
  solutionat: "Soluționat",
};
