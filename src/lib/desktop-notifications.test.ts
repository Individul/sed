import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { notificationHref, setEnabled, show } from "./desktop-notifications";
import type { Notification } from "./types";

const n = (over: Partial<Notification>): Notification => ({
  id: "1",
  user_id: "u",
  type: "assigned",
  task_id: null,
  petition_id: null,
  actor_id: null,
  actor_name: null,
  message: "mesaj",
  read: false,
  created_at: "2026-08-07T10:00:00Z",
  ...over,
});

/**
 * Ținta era scrisă în două locuri — în clopoțel și în anunțul de sistem — și
 * trebuia să ducă în același loc. Acum e una singură; testul o ține așa.
 */
describe("notificationHref", () => {
  it("sarcina are pagină proprie", () => {
    expect(notificationHref(n({ task_id: "abc" }))).toBe("/tasks/abc");
  });

  it("petiția duce la registru, dar cu numărul ei în adresă", () => {
    // N-are pagină proprie, se deschide într-o fereastră peste registru. Fără
    // parametru, notificarea care numește o petiție anume te lăsa să cauți
    // printre trei sute.
    expect(notificationHref(n({ petition_id: "xyz" }))).toBe("/petitii?petitie=xyz");
  });

  it("fără nimic legat, nu duce nicăieri", () => {
    // Anunțul tot apare, dar clickul pe el doar aduce fereastra în față.
    expect(notificationHref(n({}))).toBeNull();
  });

  it("sarcina are întâietate dacă, prin absurd, sunt amândouă", () => {
    expect(notificationHref(n({ task_id: "abc", petition_id: "xyz" }))).toBe("/tasks/abc");
  });
});

/**
 * Când apare anunțul și când tace.
 *
 * Merită testat fiindcă amândouă greșelile se simt prost: unul care apare peste
 * ecran în timp ce lucrezi chiar în aplicație e zgomot, iar unul care nu apare
 * niciodată face funcția inutilă. Mediul testelor e „node”, deci globalele de
 * browser sunt puse aici de mână.
 */
describe("când apare anunțul", () => {
  class FakeNotification {
    static permission = "granted";
    static create: FakeNotification[] = [];
    onclick: (() => void) | null = null;
    constructor(
      public title: string,
      public options?: { body?: string; tag?: string; icon?: string },
    ) {
      FakeNotification.create.push(this);
    }
    close() {}
  }

  const g = globalThis as Record<string, unknown>;

  beforeEach(() => {
    FakeNotification.create = [];
    FakeNotification.permission = "granted";
    const store = new Map<string, string>([["anunturi-pe-ecran", "1"]]);
    g.Notification = FakeNotification;
    g.window = g;
    g.document = { hidden: true };
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
  });

  afterEach(() => {
    delete g.Notification;
    delete g.window;
    delete g.document;
    delete g.localStorage;
  });

  it("apare când fila e în fundal și anunțurile sunt pornite", () => {
    show(n({ task_id: "abc", message: "Natalia a creat o sarcină" }));
    expect(FakeNotification.create).toHaveLength(1);
    expect(FakeNotification.create[0].options?.body).toBe("Natalia a creat o sarcină");
    // `tag` = id-ul: același eveniment sosit de două ori nu stivuiește două anunțuri.
    expect(FakeNotification.create[0].options?.tag).toBe("1");
  });

  it("tace când utilizatorul se uită chiar la aplicație", () => {
    (g.document as { hidden: boolean }).hidden = false;
    show(n({ task_id: "abc" }));
    expect(FakeNotification.create).toHaveLength(0);
  });

  it("tace când comutatorul e oprit, chiar cu permisiune dată", () => {
    setEnabled(false);
    show(n({ task_id: "abc" }));
    expect(FakeNotification.create).toHaveLength(0);
  });

  it("tace când permisiunea n-a fost dată", () => {
    FakeNotification.permission = "default";
    show(n({ task_id: "abc" }));
    expect(FakeNotification.create).toHaveLength(0);
  });
});
