import type { NotificationType } from "./types";

/**
 * Mesajele pentru petiții. Regulile de destinatari sunt aceleași ca la sarcini
 * (`recipientsFor` / `observersFor` din notifications.ts) — petiția are tot
 * creator și responsabil; se schimbă doar formularea.
 *
 * Petiția se identifică prin numărul de înregistrare, nu prin petiționar:
 * numărul e unic și e ce caută omul în registru.
 */
export function petitionMessageFor(
  type: NotificationType,
  petitionNumber: string,
  statusLabel?: string,
): string {
  switch (type) {
    case "created": return `Petiție nouă: ${petitionNumber}`;
    case "assigned": return `Ți-a fost atribuită petiția ${petitionNumber}`;
    case "status": return `Starea petiției ${petitionNumber} s-a schimbat${statusLabel ? `: ${statusLabel}` : ""}`;
    case "edited": return `Petiția ${petitionNumber} a fost modificată`;
    case "deleted": return `Petiția ${petitionNumber} a fost ștearsă`;
    // Petițiile n-au comentarii; ramura există doar pentru exhaustivitate.
    case "comment": return `Comentariu nou la petiția ${petitionNumber}`;
  }
}

/** Vezi `observerMessageFor`: doar atribuirea are formulare personală. */
export function petitionObserverMessageFor(
  type: NotificationType,
  petitionNumber: string,
  statusLabel?: string,
): string {
  if (type === "assigned") return `Petiția ${petitionNumber} a fost atribuită`;
  return petitionMessageFor(type, petitionNumber, statusLabel);
}
