import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bandUrgency, pendingFor, type Obligation } from "./obligations";
import { isPetitionOverdue, isTaskOverdue } from "./hub-stats";

/**
 * Ziua calendaristică se ia de pe ceasul Chișinăului, peste tot.
 *
 * Testele astea îngheață ceasul la 7 august 2026, ora 01:00 la Chișinău —
 * adică 6 august, 22:00 UTC. Fereastra dintre cele două miezuri de noapte e
 * exact locul unde `new Date()` pe Vercel întoarce încă ziua de ieri, iar
 * fiecare socoteală de termen iese greșită cu o zi.
 *
 * Niciun apel de aici nu dă data explicit: tocmai valoarea implicită se
 * verifică. Dacă cineva o schimbă înapoi la `new Date()`, testele cad.
 *
 * `vitest.config.ts` forțează `TZ=UTC`, deci mașina de test se poartă ca
 * Vercel, nu ca laptopul de la Chișinău unde greșeala s-ar ascunde.
 */
const NOAPTEA_DE_7_AUGUST = new Date("2026-08-06T22:00:00Z");

const VINERI: Obligation = {
  id: "1",
  title: "Darea de seamă săptămânală",
  recipient: "ANP",
  kind: "saptamanal",
  day_of_month: null,
  weekday: 5,
  starts_on: "2026-08-01",
  assignee_id: null,
  active: true,
  position: 0,
  created_at: "",
  updated_at: "",
};

describe("ziua calendaristică implicită", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOAPTEA_DE_7_AUGUST);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("obligația scadentă azi e văzută ca scadentă azi, nu mâine", () => {
    // Cu ceasul serverului ar da `days: 1`, iar banda ar rămâne galbenă în
    // chiar dimineața termenului.
    const p = pendingFor(VINERI, new Set());
    expect(p.due).toBe("2026-08-07");
    expect(p.days).toBe(0);
    expect(bandUrgency([p])).toBe("astazi");
  });

  it("sarcina cu termen ieri e restantă, nu scadentă", () => {
    expect(isTaskOverdue({ status: "todo", due_date: "2026-08-06" })).toBe(true);
  });

  it("petiția cu termen ieri e restantă", () => {
    expect(
      isPetitionOverdue({ status: "in_examinare", response_deadline: "2026-08-06" }),
    ).toBe(true);
  });

  it("ce e scadent mâine rămâne mâine", () => {
    // Verifică și celălalt capăt: corectarea nu trebuie să împingă totul cu o zi.
    expect(isTaskOverdue({ status: "todo", due_date: "2026-08-08" })).toBe(false);
  });
});
