import type { Notification as AppNotification } from "./types";

/**
 * Anunțuri în colțul ecranului, ca la poșta electronică.
 *
 * Partea grea era să afli că a apărut ceva; asta se face deja prin Supabase
 * Realtime, în clopoțel. Aici rămâne doar transformarea evenimentului în anunț
 * de sistem.
 *
 * Limita, spusă pe față: merge doar cât timp o filă cu aplicația e deschisă
 * undeva în browser. Cu fila închisă n-ajunge nimic — pentru asta ar fi nevoie
 * de Web Push, adică service worker, chei VAPID și un tabel de abonamente.
 */

const KEY = "anunturi-pe-ecran";
const TITLE = "Secția evidența deținuți";

/**
 * Unde duce o notificare.
 *
 * Petițiile n-au pagină proprie — se deschid într-o fereastră peste registru.
 * De aceea adresa duce la registru, dar cu numărul petiției în coadă: pagina îl
 * citește și deschide fereastra direct. Fără el, o notificare care spune
 * „Starea petiției R-567/26 s-a schimbat” te lăsa într-o listă de trei sute,
 * să cauți singur despre care e vorba.
 */
export function notificationHref(n: AppNotification): string | null {
  if (n.task_id) return `/tasks/${n.task_id}`;
  if (n.petition_id) return `/petitii?petitie=${n.petition_id}`;
  return null;
}

export function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permission(): NotificationPermission | null {
  return isSupported() ? Notification.permission : null;
}

/**
 * Preferința e ținută separat de permisiunea browserului.
 *
 * Permisiunea, o dată dată, nu se mai poate lua înapoi din pagină — doar din
 * setările browserului, unde nimeni nu intră. Fără comutatorul ăsta, „am vrut
 * să încerc” ar însemna „pentru totdeauna”.
 */
export function isEnabled(): boolean {
  if (!isSupported() || Notification.permission !== "granted") return false;
  return localStorage.getItem(KEY) === "1";
}

export function setEnabled(on: boolean): void {
  if (isSupported()) localStorage.setItem(KEY, on ? "1" : "0");
}

/** Cere permisiunea. Trebuie chemată dintr-un click, altfel browserul o ignoră. */
export async function enable(): Promise<NotificationPermission> {
  if (!isSupported()) return "denied";
  const p =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (p === "granted") setEnabled(true);
  return p;
}

/**
 * Arată anunțul, dacă e cazul.
 *
 * Nu și când utilizatorul se uită chiar la aplicație: acolo clopoțelul se
 * actualizează sub ochii lui, iar o fereastră peste ecran ar fi zgomot. La fel
 * face și poșta electronică.
 */
export function show(n: AppNotification, onOpen?: (href: string) => void): void {
  if (!isEnabled() || !document.hidden) return;

  // `tag` cu id-ul notificării: dacă evenimentul sosește de două ori, sistemul
  // înlocuiește anunțul în loc să stivuiască două identice.
  //
  // În try/catch fiindcă pe Chrome de Android constructorul aruncă TypeError —
  // acolo anunțurile cer un service worker — deși verificarea de suport trece.
  // Fără gardă, excepția cădea în mijlocul canalului de timp real, la fiecare
  // eveniment; anunțul pe ecran e un bonus, nu ceva pentru care se moare.
  let anunt: Notification;
  try {
    anunt = new Notification(TITLE, {
      body: n.message,
      icon: "/apple-icon.png",
      tag: n.id,
    });
  } catch {
    return;
  }

  const href = notificationHref(n);
  anunt.onclick = () => {
    window.focus();
    anunt.close();
    if (!href) return;
    if (onOpen) onOpen(href);
    else window.location.href = href;
  };
}
