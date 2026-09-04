import { describe, it, expect } from "vitest";
import { recipientsFor, observersFor, messageFor, observerMessageFor } from "./notifications";

const T = { assignee_id: "a" as string | null, created_by: "c" };

describe("recipientsFor", () => {
  it("assigned: doar noul responsabil, dacă nu e actorul", () => {
    expect(recipientsFor("assigned", { assignee_id: "a", created_by: "c" }, "c")).toEqual(["a"]);
  });
  it("assigned: gol dacă responsabilul e chiar actorul", () => {
    expect(recipientsFor("assigned", { assignee_id: "a", created_by: "c" }, "a")).toEqual([]);
  });
  it("assigned: gol dacă nu există responsabil", () => {
    expect(recipientsFor("assigned", { assignee_id: null, created_by: "c" }, "c")).toEqual([]);
  });
  it("comment/status/edited: responsabil + creator, fără actor, dedublați", () => {
    expect(recipientsFor("comment", T, "x").sort()).toEqual(["a", "c"]);
    expect(recipientsFor("status", T, "a")).toEqual(["c"]);
    expect(recipientsFor("edited", { assignee_id: "c", created_by: "c" }, "x")).toEqual(["c"]);
  });
  it("gol dacă singurul vizat e actorul", () => {
    expect(recipientsFor("edited", { assignee_id: null, created_by: "c" }, "c")).toEqual([]);
  });
});

describe("recipientsFor — created", () => {
  it("n-are destinatari direcți: e doar pentru observatori", () => {
    expect(recipientsFor("created", T, "x")).toEqual([]);
    expect(recipientsFor("created", T, "c")).toEqual([]);
  });
});

describe("observersFor", () => {
  it("adminii primesc copie", () => {
    expect(observersFor(["adm"], "c", ["a"])).toEqual(["adm"]);
  });
  it("actorul nu se notifică pe sine, nici când e admin", () => {
    expect(observersFor(["adm"], "adm", [])).toEqual([]);
  });
  it("adminul deja notificat direct nu primește dublură", () => {
    expect(observersFor(["adm"], "c", ["adm"])).toEqual([]);
  });
  it("mai mulți admini, filtrați independent", () => {
    expect(observersFor(["adm1", "adm2", "adm3"], "adm1", ["adm2"])).toEqual(["adm3"]);
  });
  it("gol dacă nu există admini", () => {
    expect(observersFor([], "c", [])).toEqual([]);
  });
});

describe("messageFor", () => {
  it("formulează mesaje în română cu titlul", () => {
    expect(messageFor("assigned", "Raport")).toContain("Raport");
    expect(messageFor("comment", "Raport")).toContain("Raport");
    expect(messageFor("status", "Raport", "Finalizat")).toContain("Finalizat");
    expect(messageFor("created", "Raport")).toContain("Raport");
  });
});

describe("observerMessageFor", () => {
  it("rescrie mesajul de atribuire la persoana a treia", () => {
    expect(messageFor("assigned", "Raport")).toContain("Ți-a fost");
    expect(observerMessageFor("assigned", "Raport")).not.toContain("Ți-a fost");
    expect(observerMessageFor("assigned", "Raport")).toContain("Raport");
  });
  it("lasă neatinse mesajele deja neutre", () => {
    for (const type of ["comment", "edited", "deleted", "created"] as const) {
      expect(observerMessageFor(type, "Raport")).toBe(messageFor(type, "Raport"));
    }
    expect(observerMessageFor("status", "Raport", "Finalizat")).toBe(
      messageFor("status", "Raport", "Finalizat"),
    );
  });
});
