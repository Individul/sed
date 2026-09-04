import type { Petition, PetitionStatus } from "./types";
import { fold } from "./text";

export type PetitionDueFilter = "overdue" | "soon";

export interface PetitionFilter {
  status?: PetitionStatus;
  assigneeId?: string;
  due?: PetitionDueFilter;
  search?: string;
}

/** Zile până la termen față de „azi” (negativ = restant). */
function daysUntil(deadline: string | null, today: Date): number | null {
  if (!deadline) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = deadline.split("-").map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function isPetitionOverdueOn(p: Petition, today: Date): boolean {
  const d = daysUntil(p.response_deadline, today);
  return p.status === "in_examinare" && d !== null && d < 0;
}

export function isPetitionDueSoonOn(p: Petition, today: Date, within = 5): boolean {
  const d = daysUntil(p.response_deadline, today);
  return p.status === "in_examinare" && d !== null && d >= 0 && d <= within;
}

export function filterPetitions(
  petitions: Petition[],
  f: PetitionFilter,
  today: Date = new Date(),
): Petition[] {
  const q = f.search ? fold(f.search.trim()) : "";
  return petitions.filter((p) => {
    if (f.status && p.status !== f.status) return false;
    if (f.assigneeId && p.assignee_id !== f.assigneeId) return false;
    if (f.due === "overdue" && !isPetitionOverdueOn(p, today)) return false;
    if (f.due === "soon" && !isPetitionDueSoonOn(p, today)) return false;
    if (q) {
      const hay = `${fold(p.number)} ${fold(p.petitioner)} ${fold(p.subject ?? "")}`;
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
