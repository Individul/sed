import { describe, it, expect } from "vitest";
import { hasChanges } from "./changes";

describe("hasChanges", () => {
  it("nicio diferență → fals", () => {
    expect(hasChanges({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(false);
  });
  it("o valoare schimbată → adevărat", () => {
    expect(hasChanges({ a: 1, b: "x" }, { a: 1, b: "y" })).toBe(true);
  });
  it("ignoră cheile care există doar în prev", () => {
    // Rândul din bază are coloane generate (ex. termenul petiției) care nu se trimit.
    expect(hasChanges({ a: 1, generat: "z" }, { a: 1 })).toBe(false);
  });
  it("tratează null și undefined ca fiind același lucru", () => {
    expect(hasChanges({ subject: null }, { subject: undefined })).toBe(false);
    expect(hasChanges({}, { subject: null })).toBe(false);
  });
  it("gol → text contează ca schimbare", () => {
    expect(hasChanges({ subject: null }, { subject: "Art. 91" })).toBe(true);
    expect(hasChanges({ subject: "Art. 91" }, { subject: null })).toBe(true);
  });
  it("caz real: salvare fără modificări după atașarea scanării", () => {
    const rand = {
      number: "B-591/26",
      petitioner: "Popescu Ion",
      subject: null,
      status: "in_examinare",
      assignee_id: "ana",
      response_deadline: "2026-08-24",
    };
    const trimis = {
      number: "B-591/26",
      petitioner: "Popescu Ion",
      subject: null,
      status: "in_examinare",
      assignee_id: "ana",
    };
    expect(hasChanges(rand, trimis)).toBe(false);
  });
});
