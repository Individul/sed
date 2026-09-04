import { describe, it, expect } from "vitest";
import { rangeForPeriod, toISODate, todayInChisinau } from "./periods";

describe("rangeForPeriod", () => {
  const ref = new Date(2026, 6, 30); // joi, 30 iulie 2026

  it("ziua", () => {
    const r = rangeForPeriod("zi", ref);
    expect(toISODate(r.from)).toBe("2026-07-30");
    expect(toISODate(r.to)).toBe("2026-07-30");
  });
  it("săptămâna începe luni", () => {
    const r = rangeForPeriod("saptamana", ref);
    expect(toISODate(r.from)).toBe("2026-07-27");
    expect(toISODate(r.to)).toBe("2026-08-02");
  });
  it("luna", () => {
    const r = rangeForPeriod("luna", ref);
    expect(toISODate(r.from)).toBe("2026-07-01");
    expect(toISODate(r.to)).toBe("2026-07-31");
  });
  it("trimestrul", () => {
    const r = rangeForPeriod("trimestru", ref);
    expect(toISODate(r.from)).toBe("2026-07-01");
    expect(toISODate(r.to)).toBe("2026-09-30");
  });
  it("semestrul al doilea", () => {
    const r = rangeForPeriod("semestru", ref);
    expect(toISODate(r.from)).toBe("2026-07-01");
    expect(toISODate(r.to)).toBe("2026-12-31");
  });
  it("semestrul întâi", () => {
    const r = rangeForPeriod("semestru", new Date(2026, 2, 15));
    expect(toISODate(r.from)).toBe("2026-01-01");
    expect(toISODate(r.to)).toBe("2026-06-30");
  });
  it("anul", () => {
    const r = rangeForPeriod("an", ref);
    expect(toISODate(r.from)).toBe("2026-01-01");
    expect(toISODate(r.to)).toBe("2026-12-31");
  });
});

describe("todayInChisinau", () => {
  // Vara Moldova e UTC+3, deci ziua nouă începe la 21:00 UTC.
  const LUNI_2359 = new Date(Date.UTC(2026, 7, 10, 20, 59, 59));
  const MARTI_0000 = new Date(Date.UTC(2026, 7, 10, 21, 0, 0));
  // Iarna e UTC+2, deci hotarul se mută la 22:00 UTC.
  const IARNA_2359 = new Date(Date.UTC(2026, 0, 12, 21, 59, 59));
  const IARNA_0000 = new Date(Date.UTC(2026, 0, 12, 22, 0, 0));

  it("rulează într-un fus diferit de al Chișinăului", () => {
    /*
     * Fără asta, restul descrierii nu verifică nimic: pe un ceas cu decalajul
     * Chișinăului — Europe/Bucharest, adică exact ce au mașinile de aici —
     * ziua citită greșit, de pe ceasul mașinii, coincide cu cea corectă, deci
     * `todayInChisinau` ar putea fi stricată fără să cadă un test.
     * `vitest.config.ts` pune UTC tocmai pentru asta; dacă Node ajunge iar să
     * ignore `TZ` pe Windows, se află aici, nu dintr-un raport greșit.
     */
    expect(MARTI_0000.getTimezoneOffset()).not.toBe(-180);
    expect(IARNA_0000.getTimezoneOffset()).not.toBe(-120);
  });

  it("ziua se schimbă la miezul nopții de la Chișinău, nu la cel al serverului", () => {
    expect(toISODate(todayInChisinau(LUNI_2359))).toBe("2026-08-10");
    expect(toISODate(todayInChisinau(MARTI_0000))).toBe("2026-08-11");
  });

  it("iarna hotarul e la 22:00 UTC, fiindcă se schimbă ora", () => {
    // Un decalaj fix, adunat de mână, ar greși una din cele două jumătăți de an.
    expect(toISODate(todayInChisinau(IARNA_2359))).toBe("2026-01-12");
    expect(toISODate(todayInChisinau(IARNA_0000))).toBe("2026-01-13");
  });

  it("la miezul nopții pe UTC ziua de la Chișinău e deja cea nouă", () => {
    // 00:00 UTC pe 11 august e 03:00 la Chișinău: ziua e aceeași, dar ea se
    // schimbase cu trei ore mai devreme — vezi hotarul de mai sus.
    expect(toISODate(todayInChisinau(new Date(Date.UTC(2026, 7, 11, 0, 0, 0))))).toBe("2026-08-11");
  });

  it("întoarce miezul nopții local, nu instantul primit", () => {
    // Din el se scot mai departe zile întregi (`addDays`, `getDay`), deci ora
    // n-are ce căuta înăuntru.
    const zi = todayInChisinau(new Date(Date.UTC(2026, 7, 11, 9, 34, 12, 500)));
    expect([zi.getHours(), zi.getMinutes(), zi.getSeconds(), zi.getMilliseconds()]).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it("trece peste marginea de an", () => {
    // 31 dec 2026, 22:30 UTC = 1 ianuarie 2027, 00:30 la Chișinău.
    expect(toISODate(todayInChisinau(new Date(Date.UTC(2026, 11, 31, 22, 30))))).toBe("2027-01-01");
  });
});
