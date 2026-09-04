import { describe, it, expect } from "vitest";
import { filterPetitions, type PetitionFilter } from "./petition-filters";
import type { Petition } from "./types";

const p = (over: Partial<Petition>): Petition => ({
  id: "1",
  number: "1/2026",
  petitioner: "Ion Popescu",
  petitioner_type: "detinut",
  subject: null,
  received_date: "2026-07-01",
  response_deadline: null,
  status: "in_examinare",
  response: null,
  response_date: null,
  assignee_id: null,
  created_by: "u",
  created_at: "",
  updated_at: "",
  ...over,
});

const today = new Date(2026, 6, 28); // 28 iul 2026

describe("filterPetitions", () => {
  it("fără filtre întoarce tot", () => {
    expect(filterPetitions([p({}), p({ id: "2" })], {}, today)).toHaveLength(2);
  });

  it("filtrează după stare", () => {
    const r = filterPetitions(
      [p({ id: "a" }), p({ id: "b", status: "solutionat" })],
      { status: "solutionat" },
      today,
    );
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("filtrează după responsabil", () => {
    const r = filterPetitions(
      [p({ id: "a", assignee_id: "u1" }), p({ id: "b", assignee_id: "u2" })],
      { assigneeId: "u1" },
      today,
    );
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("caută fără diacritice în număr, petiționar și obiect", () => {
    const items = [
      p({ id: "a", petitioner: "Crîlov Pavel" }),
      p({ id: "b", subject: "Solicitare hotărâre" }),
      p({ id: "c", number: "42/2026" }),
      p({ id: "d", petitioner: "Altcineva" }),
    ];
    expect(filterPetitions(items, { search: "crilov" }, today).map((x) => x.id)).toEqual(["a"]);
    expect(filterPetitions(items, { search: "hotarare" }, today).map((x) => x.id)).toEqual(["b"]);
    expect(filterPetitions(items, { search: "42" }, today).map((x) => x.id)).toEqual(["c"]);
  });

  it("filtrează restantele (termen trecut, în examinare)", () => {
    const items = [
      p({ id: "a", response_deadline: "2026-07-20" }),
      p({ id: "b", response_deadline: "2026-07-20", status: "solutionat" }),
      p({ id: "c", response_deadline: "2026-08-20" }),
    ];
    expect(filterPetitions(items, { due: "overdue" }, today).map((x) => x.id)).toEqual(["a"]);
  });

  it("filtrează scadentele în 5 zile (fără restante)", () => {
    const items = [
      p({ id: "a", response_deadline: "2026-07-30" }),
      p({ id: "b", response_deadline: "2026-08-20" }),
      p({ id: "c", response_deadline: "2026-07-20" }),
    ];
    expect(filterPetitions(items, { due: "soon" }, today).map((x) => x.id)).toEqual(["a"]);
  });

  it("combină filtrele (AND)", () => {
    const items = [
      p({ id: "a", assignee_id: "u1", status: "in_examinare" }),
      p({ id: "b", assignee_id: "u1", status: "solutionat" }),
      p({ id: "c", assignee_id: "u2", status: "in_examinare" }),
    ];
    const f: PetitionFilter = { assigneeId: "u1", status: "in_examinare" };
    expect(filterPetitions(items, f, today).map((x) => x.id)).toEqual(["a"]);
  });
});
