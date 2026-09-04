import { describe, it, expect } from "vitest";
import {
  aggregate,
  computeIndicators,
  missingWorkdays,
  type HearingCounts,
} from "./hearings";

const c = (over: Partial<HearingCounts> = {}): HearingCounts => ({
  tc_petrecute: 0, tc_amanate: 0, ij_petrecute: 0, ij_amanate: 0, ...over,
});

describe("computeIndicators", () => {
  it("totalul pe categorie e petrecute + amânate", () => {
    const i = computeIndicators(c({ tc_petrecute: 5, tc_amanate: 2 }));
    expect(i.tc_total).toBe(7);
  });
  it("totalul general adună cele două categorii", () => {
    const i = computeIndicators(
      c({ tc_petrecute: 5, tc_amanate: 2, ij_petrecute: 8, ij_amanate: 1 }),
    );
    expect(i.tc_total).toBe(7);
    expect(i.ij_total).toBe(9);
    expect(i.total).toBe(16);
  });
  it("petrecute și amânate se însumează peste categorii", () => {
    const i = computeIndicators(
      c({ tc_petrecute: 5, tc_amanate: 2, ij_petrecute: 8, ij_amanate: 1 }),
    );
    expect(i.petrecute).toBe(13);
    expect(i.amanate).toBe(3);
    expect(i.petrecute + i.amanate).toBe(i.total);
  });
  it("zi goală", () => {
    expect(computeIndicators(c()).total).toBe(0);
  });
});

describe("aggregate", () => {
  it("adună mai multe zile", () => {
    const i = aggregate([
      c({ tc_petrecute: 3, ij_amanate: 1 }),
      c({ tc_petrecute: 2, ij_petrecute: 4 }),
    ]);
    expect(i.tc_petrecute).toBe(5);
    expect(i.ij_petrecute).toBe(4);
    expect(i.ij_amanate).toBe(1);
    expect(i.total).toBe(10);
  });
  it("suma zilelor e egală cu totalul perioadei", () => {
    // Proprietatea care face raportul credibil: perioada nu poate spune altceva
    // decât zilele din care e compusă.
    const days = [
      c({ tc_petrecute: 3, tc_amanate: 1, ij_petrecute: 2, ij_amanate: 4 }),
      c({ tc_petrecute: 7, tc_amanate: 0, ij_petrecute: 5, ij_amanate: 2 }),
      c({ tc_petrecute: 1, tc_amanate: 6, ij_petrecute: 0, ij_amanate: 3 }),
    ];
    const perioada = aggregate(days);
    const sumaZilelor = days.reduce((n, d) => n + computeIndicators(d).total, 0);
    expect(perioada.total).toBe(sumaZilelor);
  });
  it("listă goală", () => {
    expect(aggregate([]).total).toBe(0);
  });
});

describe("missingWorkdays", () => {
  const luni = new Date(2026, 6, 27); // 27 iul 2026, luni
  const range = { from: luni, to: new Date(2026, 7, 2, 23, 59) }; // luni–duminică

  it("sare peste sâmbătă și duminică", () => {
    const azi = new Date(2026, 7, 2); // duminică, deci toată săptămâna e trecută
    const lipsa = missingWorkdays(range, [], azi);
    expect(lipsa).toEqual([
      "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31",
    ]);
  });

  it("scoate zilele deja introduse", () => {
    const azi = new Date(2026, 7, 2);
    const lipsa = missingWorkdays(
      range,
      [{ session_date: "2026-07-28" }, { session_date: "2026-07-30" }],
      azi,
    );
    expect(lipsa).toEqual(["2026-07-27", "2026-07-29", "2026-07-31"]);
  });

  it("nu raportează zilele care încă n-au venit", () => {
    const azi = new Date(2026, 6, 29); // miercuri
    expect(missingWorkdays(range, [], azi)).toEqual(["2026-07-27", "2026-07-28", "2026-07-29"]);
  });

  it("interval întreg în viitor → nimic", () => {
    const viitor = { from: new Date(2027, 0, 4), to: new Date(2027, 0, 8) };
    expect(missingWorkdays(viitor, [], new Date(2026, 6, 30))).toEqual([]);
  });

  it("toate zilele introduse → nimic", () => {
    const azi = new Date(2026, 6, 28);
    const lipsa = missingWorkdays(
      range,
      [{ session_date: "2026-07-27" }, { session_date: "2026-07-28" }],
      azi,
    );
    expect(lipsa).toEqual([]);
  });
});
