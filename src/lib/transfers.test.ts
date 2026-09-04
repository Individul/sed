import { describe, expect, it } from "vitest";
import {
  INSTITUTIONS,
  byInstitution,
  defaultTransferDate,
  institutionLabel,
  scheduledDays,
  isScheduled,
  nextScheduled,
  missingScheduled,
  aggregate,
} from "./transfers";
import { toISODate } from "./periods";

describe("instituțiile", () => {
  it("sunt 16: 1-18 fără 6 (noi) și fără 14 (nu există)", () => {
    expect(INSTITUTIONS).toHaveLength(16);
    expect(INSTITUTIONS).not.toContain(6);
    expect(INSTITUTIONS).not.toContain(14);
    expect(INSTITUTIONS[0]).toBe(1);
    expect(INSTITUTIONS.at(-1)).toBe(18);
  });

  it("compune eticheta", () => {
    expect(institutionLabel(3)).toBe("Penitenciarul nr. 3");
  });
});

describe("zilele programate", () => {
  it("prima și a treia luni — iulie 2026 începe miercuri", () => {
    expect(scheduledDays(2026, 6).map(toISODate)).toEqual(["2026-07-06", "2026-07-20"]);
  });

  it("când întâi e chiar luni, aceea e prima", () => {
    expect(scheduledDays(2026, 5).map(toISODate)).toEqual(["2026-06-01", "2026-06-15"]);
  });

  it("când întâi e duminică, prima luni e a doua zi", () => {
    expect(scheduledDays(2026, 10).map(toISODate)).toEqual(["2026-11-02", "2026-11-16"]);
  });

  it("a treia luni rămâne mereu în aceeași lună", () => {
    for (let m = 0; m < 12; m++) {
      const [, third] = scheduledDays(2026, m);
      expect(third.getMonth()).toBe(m);
    }
  });

  it("recunoaște o zi programată și una obișnuită", () => {
    expect(isScheduled(new Date(2026, 6, 6))).toBe(true);
    expect(isScheduled(new Date(2026, 6, 13))).toBe(false);
  });
});

describe("următorul transfer", () => {
  it("îl dă pe cel din luna curentă dacă n-a trecut", () => {
    expect(toISODate(nextScheduled(new Date(2026, 6, 10)))).toBe("2026-07-20");
  });

  it("trece în luna următoare când amândouă au trecut", () => {
    expect(toISODate(nextScheduled(new Date(2026, 6, 25)))).toBe("2026-08-03");
  });

  it("ziua programată de azi e tot ea, nu următoarea", () => {
    expect(toISODate(nextScheduled(new Date(2026, 6, 20)))).toBe("2026-07-20");
  });
});

describe("zilele programate necompletate", () => {
  const range = { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) };

  it("le arată pe cele fără niciun rând", () => {
    const entered = [{ transfer_date: "2026-07-06" }];
    expect(missingScheduled(range, entered, new Date(2026, 6, 25))).toEqual(["2026-07-20"]);
  });

  it("o zi viitoare nu poate lipsi", () => {
    expect(missingScheduled(range, [], new Date(2026, 6, 10))).toEqual(["2026-07-06"]);
  });

  it("nimic de semnalat când sunt completate toate", () => {
    const entered = [{ transfer_date: "2026-07-06" }, { transfer_date: "2026-07-20" }];
    expect(missingScheduled(range, entered, new Date(2026, 6, 25))).toEqual([]);
  });

  it("ziua de azi nu lipsește, transferul e în curs", () => {
    // Nici la miezul nopții, nici în timpul zilei: munca nu e încă scadentă.
    expect(missingScheduled(range, [], new Date(2026, 6, 6, 0, 0))).toEqual([]);
    expect(missingScheduled(range, [], new Date(2026, 6, 6, 9, 0))).toEqual([]);
  });

  it("aceeași zi lipsește mâine, după ce s-a încheiat", () => {
    expect(missingScheduled(range, [], new Date(2026, 6, 7, 9, 0))).toEqual(["2026-07-06"]);
  });

  it("un interval care începe chiar azi n-are ce semnala", () => {
    const startsToday = { from: new Date(2026, 6, 6), to: new Date(2026, 6, 31) };
    expect(missingScheduled(startsToday, [], new Date(2026, 6, 6, 9, 0))).toEqual([]);
  });
});

describe("agregarea", () => {
  it("adună și scoate soldul", () => {
    const r = aggregate([
      { plecati: 5, sositi: 2 },
      { plecati: 7, sositi: 0 },
      { plecati: 0, sositi: 7 },
    ]);
    expect(r).toEqual({ plecati: 12, sositi: 9, total: 21, sold: -3 });
  });

  it("soldul e pozitiv când au sosit mai mulți decât au plecat", () => {
    expect(aggregate([{ plecati: 2, sositi: 9 }]).sold).toBe(7);
  });

  it("fără rânduri dă zerouri, nu NaN", () => {
    expect(aggregate([])).toEqual({ plecati: 0, sositi: 0, total: 0, sold: 0 });
  });
});

describe("defalcarea pe penitenciar", () => {
  it("adună rândurile aceleiași instituții, oricâte ar fi", () => {
    // Aceeași instituție poate apărea de două ori într-o lună: o dată la
    // transferul programat, o dată la unul urgent.
    expect(
      byInstitution([
        { institution: 3, plecati: 5, sositi: 2 },
        { institution: 3, plecati: 1, sositi: 0 },
      ]),
    ).toEqual([{ institution: 3, plecati: 6, sositi: 2 }]);
  });

  it("lasă afară instituțiile fără nicio mișcare", () => {
    expect(
      byInstitution([
        { institution: 3, plecati: 5, sositi: 0 },
        { institution: 11, plecati: 0, sositi: 0 },
      ]),
    ).toEqual([{ institution: 3, plecati: 5, sositi: 0 }]);
  });

  it("pune în față instituțiile cu cea mai multă mișcare", () => {
    const out = byInstitution([
      { institution: 3, plecati: 1, sositi: 0 },
      { institution: 11, plecati: 4, sositi: 3 },
      { institution: 5, plecati: 0, sositi: 2 },
    ]);
    expect(out.map((r) => r.institution)).toEqual([11, 5, 3]);
  });

  it("la mișcare egală merge după numărul instituției", () => {
    const out = byInstitution([
      { institution: 11, plecati: 2, sositi: 0 },
      { institution: 3, plecati: 0, sositi: 2 },
    ]);
    expect(out.map((r) => r.institution)).toEqual([3, 11]);
  });

  it("fără rânduri dă listă goală", () => {
    expect(byInstitution([])).toEqual([]);
  });
});

describe("defaultTransferDate", () => {
  // 31 iulie 2026, vineri. Zile programate în iulie: 6 și 20; în august: 3 și 17.
  const azi = new Date(2026, 6, 31);

  it("propune cel mai vechi gol, nu ziua curentă", () => {
    expect(defaultTransferDate(["2026-07-06", "2026-07-20"], azi)).toBe("2026-07-06");
  });

  it("fără goluri, propune următoarea zi programată", () => {
    expect(defaultTransferDate([], azi)).toBe("2026-08-03");
  });

  it("nu propune niciodată o zi care nu e de transfer", () => {
    // Ziua curentă (31 iul) nu e nici prima, nici a treia luni din lună.
    expect(defaultTransferDate([], azi)).not.toBe("2026-07-31");
  });

  it("pe o zi programată neintrodusă încă, o propune pe ea", () => {
    const luni = new Date(2026, 7, 3); // 3 august, prima luni
    expect(defaultTransferDate([], luni)).toBe("2026-08-03");
  });
});
