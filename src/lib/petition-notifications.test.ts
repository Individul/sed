import { describe, it, expect } from "vitest";
import { petitionMessageFor, petitionObserverMessageFor } from "./petition-notifications";
import { recipientsFor } from "./notifications";

const NR = "M-535/26";

describe("petitionMessageFor", () => {
  it("numește petiția prin numărul de înregistrare", () => {
    for (const type of ["created", "assigned", "edited", "deleted"] as const) {
      expect(petitionMessageFor(type, NR)).toContain(NR);
    }
  });
  it("spune „petiția”, nu „sarcina”", () => {
    expect(petitionMessageFor("edited", NR).toLowerCase()).toContain("petiția");
    expect(petitionMessageFor("edited", NR).toLowerCase()).not.toContain("sarcina");
  });
  it("include eticheta de stare când e dată", () => {
    expect(petitionMessageFor("status", NR, "Soluționat")).toContain("Soluționat");
    expect(petitionMessageFor("status", NR)).toContain(NR);
  });
});

describe("petitionObserverMessageFor", () => {
  it("rescrie atribuirea la persoana a treia", () => {
    expect(petitionMessageFor("assigned", NR)).toContain("Ți-a fost");
    expect(petitionObserverMessageFor("assigned", NR)).not.toContain("Ți-a fost");
    expect(petitionObserverMessageFor("assigned", NR)).toContain(NR);
  });
  it("lasă neatinse mesajele deja neutre", () => {
    for (const type of ["created", "edited", "deleted"] as const) {
      expect(petitionObserverMessageFor(type, NR)).toBe(petitionMessageFor(type, NR));
    }
  });
});

describe("destinatarii se calculează la fel ca la sarcini", () => {
  const petition = { assignee_id: "resp", created_by: "autor" };
  it("„created” rămâne doar pentru observatori", () => {
    expect(recipientsFor("created", petition, "autor")).toEqual([]);
  });
  it("modificarea merge la responsabil și creator, fără actor", () => {
    expect(recipientsFor("edited", petition, "resp")).toEqual(["autor"]);
  });
});
