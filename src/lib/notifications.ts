import type { NotificationType } from "./types";

type TaskRef = { assignee_id: string | null; created_by: string };

export function recipientsFor(type: NotificationType, task: TaskRef, actorId: string): string[] {
  // „created" n-are destinatari direcți: e strict pentru observatori (admini).
  if (type === "created") return [];
  if (type === "assigned") {
    return task.assignee_id && task.assignee_id !== actorId ? [task.assignee_id] : [];
  }
  const set = new Set<string>();
  if (task.assignee_id) set.add(task.assignee_id);
  set.add(task.created_by);
  set.delete(actorId);
  return [...set];
}

/**
 * Adminii primesc copie la orice acțiune, ca să vadă ce face echipa. Se scot
 * actorul (nu se notifică pe sine) și cei deja notificați direct, ca aceeași
 * acțiune să nu ajungă de două ori la aceeași persoană.
 */
export function observersFor(adminIds: string[], actorId: string, direct: string[]): string[] {
  return adminIds.filter((id) => id !== actorId && !direct.includes(id));
}

export function messageFor(type: NotificationType, title: string, statusLabel?: string): string {
  switch (type) {
    case "created": return `Sarcină nouă: „${title}"`;
    case "assigned": return `Ți-a fost atribuită sarcina „${title}"`;
    case "comment": return `Comentariu nou la „${title}"`;
    case "status": return `Starea sarcinii „${title}" s-a schimbat${statusLabel ? `: ${statusLabel}` : ""}`;
    case "edited": return `Sarcina „${title}" a fost modificată`;
    case "deleted": return `Sarcina „${title}" a fost ștearsă`;
  }
}

/**
 * Mesajul pentru admin, care e observator, nu parte implicată. Doar „assigned"
 * are formulare personală („ți-a fost atribuită") și trebuie rescrisă; restul
 * sunt deja neutre. Numele autorului nu se repetă în text — clopoțelul îl
 * afișează separat, sub mesaj.
 */
export function observerMessageFor(
  type: NotificationType,
  title: string,
  statusLabel?: string,
): string {
  if (type === "assigned") return `Sarcina „${title}" a fost atribuită`;
  return messageFor(type, title, statusLabel);
}
