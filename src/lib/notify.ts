import { createClient } from "@/lib/supabase/server";
import {
  recipientsFor,
  observersFor,
  messageFor,
  observerMessageFor,
} from "@/lib/notifications";
import type { NotificationType } from "@/lib/types";

export async function notify(
  type: NotificationType,
  task: { id: string; title: string; assignee_id: string | null; created_by: string },
  actorId: string,
  statusLabel?: string,
  /**
   * Adminii primesc copie de observator. Se trece pe `false` doar când aceeași
   * acțiune le trimite deja altă notificare (ex. „created" la creare).
   */
  includeAdmins = true,
): Promise<void> {
  const direct = recipientsFor(type, task, actorId);
  // best-effort: notificările nu trebuie să blocheze niciodată acțiunea de bază.
  try {
    const supabase = createClient();

    let observers: string[] = [];
    if (includeAdmins) {
      const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
      observers = observersFor((admins ?? []).map((a) => a.id as string), actorId, direct);
    }
    if (direct.length === 0 && observers.length === 0) return;

    const send = (recipients: string[], message: string) =>
      supabase.rpc("create_notifications", {
        p_recipients: recipients,
        p_type: type,
        // la ștergere, sarcina nu mai există → link mort; nu referi un id inexistent (FK).
        p_task_id: type === "deleted" ? null : task.id,
        p_message: message,
      });

    if (direct.length) await send(direct, messageFor(type, task.title, statusLabel));
    if (observers.length) {
      await send(observers, observerMessageFor(type, task.title, statusLabel));
    }
  } catch {
    // ignorat intenționat (ex: migrarea 0008 neaplicată, eroare de rețea).
  }
}
