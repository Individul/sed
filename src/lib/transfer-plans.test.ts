import { describe, expect, it } from "vitest";
import {
  groupByTransferDay,
  planTransferDay,
  transferDayFor,
  transferDayForDecision,
  type TransferPlan,
} from "./transfer-plans";
import { scheduledDays } from "./transfers";
import { toISODate } from "./periods";

// Zile programate: 6 și 20 iulie 2026, 3 și 17 august 2026.
const IUL = scheduledDays(2026, 6).map(toISODate);
const AUG = scheduledDays(2026, 7).map(toISODate);

const plan = (over: Partial<TransferPlan>): TransferPlan => ({
  id: "1", last_name: "Popescu", first_name: "Ion",
  basis: "sedinta", court: "Judecătoria Chișinău", institution: 13,
  hearing_date: "2026-08-05", decision_date: null, done: false, note: null,
  created_by: null, updated_by: null, created_at: "", updated_at: "", ...over,
});

describe("zilele de referință", () => {
  it("iulie și august 2026", () => {
    expect(IUL).toEqual(["2026-07-06", "2026-07-20"]);
    expect(AUG).toEqual(["2026-08-03", "2026-08-17"]);
  });
});

describe("transferDayFor", () => {
  const azi = new Date(2026, 6, 31); // 31 iulie 2026

  it("alege ultima zi programată dinaintea ședinței, nu prima disponibilă", () => {
    // Ședință pe 20 august: se poate și pe 3, dar omul ar aștepta două
    // săptămâni degeaba la altă instituție.
    expect(transferDayFor(new Date(2026, 7, 20), azi)).toBe("2026-08-17");
  });

  it("ședință între zilele programate", () => {
    expect(transferDayFor(new Date(2026, 7, 5), azi)).toBe("2026-08-03");
  });

  it("nu propune ziua ședinței, chiar dacă e zi de transfer", () => {
    // Ședință pe 20 iulie, care e și zi programată: transferul de atunci nu mai
    // ajută, deci rămâne cel de pe 6.
    expect(transferDayFor(new Date(2026, 6, 20), new Date(2026, 6, 1))).toBe("2026-07-06");
  });

  it("sare peste zilele deja trecute", () => {
    // Pe 10 iulie, ziua de 6 a trecut; pentru o ședință pe 3 august rămâne 20.
    expect(transferDayFor(new Date(2026, 7, 3), new Date(2026, 6, 10))).toBe("2026-07-20");
  });

  it("fără zi posibilă → null, adică de înștiințat instanța", () => {
    // Ședință pe 1 august; ultima zi programată înainte era 20 iulie, trecută.
    expect(transferDayFor(new Date(2026, 7, 1), azi)).toBeNull();
  });

  it("ședință chiar azi → null", () => {
    expect(transferDayFor(azi, azi)).toBeNull();
  });

  it("ședință peste luni de zile", () => {
    // Octombrie 2026: prima luni 5, a treia 19.
    expect(transferDayFor(new Date(2026, 9, 21), azi)).toBe("2026-10-19");
  });
});

describe("groupByTransferDay", () => {
  const azi = new Date(2026, 6, 31);

  it("grupează pe ziua calculată, cronologic", () => {
    const groups = groupByTransferDay(
      [
        plan({ id: "a", hearing_date: "2026-08-20" }), // → 17 aug
        plan({ id: "b", hearing_date: "2026-08-05" }), // → 3 aug
      ],
      azi,
    );
    expect(groups.map((g) => g.day)).toEqual(["2026-08-03", "2026-08-17"]);
  });

  it("cele fără zi posibilă ies primele", () => {
    const groups = groupByTransferDay(
      [
        plan({ id: "a", hearing_date: "2026-08-20" }),
        plan({ id: "b", hearing_date: "2026-08-01" }), // imposibil
      ],
      azi,
    );
    expect(groups[0].day).toBeNull();
    expect(groups[0].plans.map((p) => p.id)).toEqual(["b"]);
  });

  it("cele încheiate nu mai apar", () => {
    const groups = groupByTransferDay([plan({ done: true })], azi);
    expect(groups).toEqual([]);
  });

  it("în aceeași zi, ședințele mai apropiate primele", () => {
    const groups = groupByTransferDay(
      [
        plan({ id: "tarziu", hearing_date: "2026-08-14" }),
        plan({ id: "devreme", hearing_date: "2026-08-05" }),
      ],
      azi,
    );
    expect(groups[0].plans.map((p) => p.id)).toEqual(["devreme", "tarziu"]);
  });

  it("amânarea mută însemnarea pe altă zi", () => {
    // Motivul principal al modulului: o ședință amânată nu mai cere
    // replanificare manuală.
    const inainte = groupByTransferDay([plan({ hearing_date: "2026-08-05" })], azi);
    const dupa = groupByTransferDay([plan({ hearing_date: "2026-08-20" })], azi);
    expect(inainte[0].day).toBe("2026-08-03");
    expect(dupa[0].day).toBe("2026-08-17");
  });
});

/*
 * Zilele programate din iulie–august 2026: 6 și 20 iulie, 3 și 17 august.
 * Regula deciziei e răsturnată față de a ședinței — de aceea are teste proprii,
 * nu doar o variantă a celor de sus.
 */
describe("transferul în baza unei decizii", () => {
  it("merge la prima zi programată de după parvenire", () => {
    // Decizie pe 10 iulie: prima zi de după e 20 iulie.
    expect(transferDayForDecision(new Date(2026, 6, 10), new Date(2026, 6, 1))).toBe("2026-07-20");
  });

  it("dacă parvine chiar într-o zi de transfer, aceea e", () => {
    expect(transferDayForDecision(new Date(2026, 6, 6), new Date(2026, 6, 1))).toBe("2026-07-06");
  });

  it("parvenită după ultima zi a lunii, trece în luna următoare", () => {
    expect(transferDayForDecision(new Date(2026, 6, 25), new Date(2026, 6, 1))).toBe("2026-08-03");
  });

  it("o decizie veche neexecutată nu trimite omul la o zi trecută", () => {
    // Parvenită pe 10 iulie, ziua ei (20 iulie) a trecut, azi e 25 iulie:
    // se mută la următoarea, ca o ședință amânată.
    expect(transferDayForDecision(new Date(2026, 6, 10), new Date(2026, 6, 25))).toBe("2026-08-03");
  });

  it("nu întoarce niciodată „de înștiințat instanța”", () => {
    // Spre deosebire de ședință, aici există întotdeauna o zi următoare.
    const p = plan({ basis: "decizie", court: null, hearing_date: null, decision_date: "2026-07-10" });
    expect(planTransferDay(p, new Date(2026, 6, 1))).toBe("2026-07-20");
  });
});

describe("ședințe și decizii în aceeași listă", () => {
  it("se adună pe aceeași zi de transfer când coincid", () => {
    const azi = new Date(2026, 6, 1);
    // Ședință pe 22 iulie → ultima zi dinainte e 20 iulie.
    const sedinta = plan({ id: "s", hearing_date: "2026-07-22" });
    // Decizie parvenită pe 10 iulie → prima zi de după e tot 20 iulie.
    const decizie = plan({
      id: "d", basis: "decizie", court: null, hearing_date: null, decision_date: "2026-07-10",
    });
    const grupe = groupByTransferDay([sedinta, decizie], azi);
    expect(grupe).toHaveLength(1);
    expect(grupe[0].day).toBe("2026-07-20");
    expect(grupe[0].plans.map((x) => x.id).sort()).toEqual(["d", "s"]);
  });
});
