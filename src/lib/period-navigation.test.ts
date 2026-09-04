import { describe, expect, it } from "vitest";
import { rangeForPeriod, readAnchor, shiftPeriod, toISODate } from "./periods";

const zi = (d: Date) => toISODate(d);

describe("shiftPeriod", () => {
  it("un pas înapoi de la 1 septembrie dă august", () => {
    // Cazul care a pornit totul: pe 1 septembrie vrei totalul lunii august.
    const aug = shiftPeriod("luna", new Date(2026, 8, 1), -1);
    const r = rangeForPeriod("luna", aug);
    expect(zi(r.from)).toBe("2026-08-01");
    expect(zi(r.to)).toBe("2026-08-31");
  });

  it("pașii sunt reversibili: înapoi și înainte te aduce de unde ai plecat", () => {
    // Aici s-ar vedea alunecarea de la lunile scurte, dacă ar exista.
    const start = new Date(2026, 2, 31); // 31 martie
    const inapoi = shiftPeriod("luna", start, -1);
    const inainte = shiftPeriod("luna", inapoi, 1);
    expect(zi(rangeForPeriod("luna", inainte).from)).toBe("2026-03-01");
  });

  it("nu alunecă pe ziua 28 după o trecere prin februarie", () => {
    // Pornit din 31 martie fără normalizare, doi pași înapoi dădeau 28 ianuarie.
    let d = new Date(2026, 2, 31);
    for (let i = 0; i < 2; i++) d = shiftPeriod("luna", d, -1);
    expect(zi(rangeForPeriod("luna", d).from)).toBe("2026-01-01");
  });

  it("trimestrul sare trei luni, semestrul șase", () => {
    expect(zi(rangeForPeriod("trimestru", shiftPeriod("trimestru", new Date(2026, 8, 1), -1)).from))
      .toBe("2026-04-01");
    expect(zi(rangeForPeriod("semestru", shiftPeriod("semestru", new Date(2026, 8, 1), -1)).from))
      .toBe("2026-01-01");
  });

  it("anul, ziua și săptămâna se mută cu unitatea lor", () => {
    expect(zi(shiftPeriod("an", new Date(2026, 8, 1), -1))).toBe("2025-01-01");
    expect(zi(shiftPeriod("zi", new Date(2026, 8, 1), -1))).toBe("2026-08-31");
    // Săptămâna începe luni: 1 sept 2026 e marți, deci începutul e 31 august.
    expect(zi(shiftPeriod("saptamana", new Date(2026, 8, 1), -1))).toBe("2026-08-24");
  });
});

describe("readAnchor", () => {
  const AZI = new Date(2026, 8, 1);

  it("fără parametru rămâne azi", () => {
    expect(zi(readAnchor(undefined, AZI))).toBe("2026-09-01");
  });

  it("o dată bună din trecut e primită", () => {
    expect(zi(readAnchor("2026-08-15", AZI))).toBe("2026-08-15");
  });

  it("o zi care nu există nu e crezută", () => {
    // „2026-02-30" trece de tipar, dar V8 o rostogolește la 2 martie: raportul
    // ar arăta altă lună decât scrie în adresă.
    expect(zi(readAnchor("2026-02-30", AZI))).toBe("2026-09-01");
  });

  it("format greșit sau gunoi cade înapoi pe azi", () => {
    expect(zi(readAnchor("august", AZI))).toBe("2026-09-01");
    expect(zi(readAnchor("2026-8-1", AZI))).toBe("2026-09-01");
  });

  it("viitorul se retează la azi", () => {
    expect(zi(readAnchor("2027-01-01", AZI))).toBe("2026-09-01");
  });

  it("parametrul repetat în adresă: se ia primul", () => {
    expect(zi(readAnchor(["2026-08-15", "2026-07-01"], AZI))).toBe("2026-08-15");
  });
});
