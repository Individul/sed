import type { Task, TaskStatus, TaskPriority } from "./types";
import { isTaskDueSoon, isTaskOverdue } from "./hub-stats";
import { fold } from "./text";

export const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export type DueFilter = "overdue" | "soon";

export interface TaskFilter {
  status?: TaskStatus;
  assigneeId?: string;
  priority?: TaskPriority;
  due?: DueFilter;
  tagId?: string;
  search?: string;
}

export function filterTasks(tasks: Task[], f: TaskFilter): Task[] {
  const now = new Date();

  return tasks.filter((t) => {
    if (f.status && t.status !== f.status) return false;
    if (f.assigneeId && t.assignee_id !== f.assigneeId) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.tagId && !(t.tags ?? []).some((tag) => tag.id === f.tagId)) return false;
    if (f.search) {
      const q = fold(f.search.trim());
      if (q && !fold(t.title).includes(q) && !fold(t.description ?? "").includes(q)) {
        return false;
      }
    }
    // Aceleași predicate ca pe cardul de start și în celula de termen: cifra
    // „Restante" trebuie să fie una singură, oriunde apare. Recalculările
    // private ale aceleiași întrebări au produs deja contradicții pe ecran.
    if (f.due === "overdue" && !isTaskOverdue(t, now)) return false;
    if (f.due === "soon" && !isTaskDueSoon(t, now)) return false;
    return true;
  });
}

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
