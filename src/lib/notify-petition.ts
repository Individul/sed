import { createClient } from "@/lib/supabase/server";
import { recipientsFor, observersFor } from "@/lib/notifications";
import { petitionMessageFor, petitionObserverMessageFor } from "@/lib/petition-notifications";
import type { NotificationType } from "@/lib/types";

export async function notifyPetition(
  type: NotificationType,
  petition: { id: string; number: string; assignee_id: string | null; created_by: string },
  actorId: string,
  statusLabel?: string,
  /** Vezi `notify`: se oprește copia de observator când adminii primesc deja alta. */
  includeAdmins = true,
): Promise<void> {
  const direct = recipientsFor(type, petition, actorId);
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
        p_task_id: null,
        // la ștergere petiția nu mai există → cheia străină ar pica; fără legătură.
        p_petition_id: type === "deleted" ? null : petition.id,
        p_message: message,
      });

    if (direct.length) {
      await send(direct, petitionMessageFor(type, petition.number, statusLabel));
    }
    if (observers.length) {
      await send(observers, petitionObserverMessageFor(type, petition.number, statusLabel));
    }
  } catch {
    // ignorat intenționat (ex: migrarea 0015 neaplicată, eroare de rețea).
  }
}
