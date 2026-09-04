import { describe, it, expect } from "vitest";
import { AUDIT_MODULES, entitiesFor, readAuditModule } from "./audit-modules";
import type { AuditEntry } from "./types";

/**
 * Toate entitățile pe care le scrie trigger-ul de audit.
 *
 * Un Record peste uniune: TypeScript refuză compilarea dacă lipsește o entitate,
 * deci lista nu poate rămâne în urmă față de tip. Scrisă de mână, lista nu păzea
 * nimic — o entitate nouă nu ajungea în ea, deci bucla de mai jos pur și simplu
 * n-o verifica, iar testul trecea cu exact bug-ul pe care spune că-l prinde.
 */
const ENTITY_PRESENT: Record<AuditEntry["entity"], true> = {
  tasks: true,
  subtasks: true,
  comments: true,
  tags: true,
  task_tags: true,
  petitions: true,
  petition_attachments: true,
  hearings: true,
  profiles: true,
  transfers: true,
  transfer_plans: true,
  obligations: true,
  obligation_completions: true,
  defendants: true,
  releases: true,
};
const ALL_ENTITIES = Object.keys(ENTITY_PRESENT) as AuditEntry["entity"][];

describe("AUDIT_MODULES", () => {
  it("fiecare entitate aparține exact unui modul", () => {
    // Garda care contează: o entitate nouă, uitată la mapare, ar dispărea din
    // toate taburile în afară de „Toate" — fără niciun semn că lipsește.
    for (const entity of ALL_ENTITIES) {
      const owners = AUDIT_MODULES.filter(
        (m) => m.value !== "toate" && m.entities.includes(entity),
      );
      expect(owners.map((o) => o.value)).toHaveLength(1);
    }
  });

  it("niciun modul nu revendică o entitate inexistentă", () => {
    for (const m of AUDIT_MODULES) {
      for (const entity of m.entities) expect(ALL_ENTITIES).toContain(entity);
    }
  });

  it("„Toate” nu filtrează nimic", () => {
    expect(entitiesFor("toate")).toEqual([]);
  });

  it("„Transferuri” cere doar entitatea transfers", () => {
    expect(entitiesFor("transferuri")).toEqual(["transfers", "transfer_plans"]);
  });
});

describe("readAuditModule", () => {
  it("acceptă valorile cunoscute", () => {
    expect(readAuditModule("petitii")).toBe("petitii");
    expect(readAuditModule("sedinte")).toBe("sedinte");
    expect(readAuditModule("transferuri")).toBe("transferuri");
  });
  it("cade pe „toate” la valori lipsă sau inventate", () => {
    expect(readAuditModule(undefined)).toBe("toate");
    expect(readAuditModule("altceva")).toBe("toate");
  });
});
