import { describe, expect, it } from "vitest";
import { startOfDay } from "date-fns";
import { readWeek, reportWeek, shiftWeek, weeklyFigures, type WeeklyRows } from "./weekly-report";
import { toISODate, todayInChisinau } from "./periods";

const iso = (r: { from: Date; to: Date }) => [toISODate(r.from), toISODate(r.to)];

describe("săptămâna raportului", () => {
  it("marți arată săptămâna tocmai încheiată, nu ziua curentă", () => {
    // 4 august 2026 e marți. Raportul de azi acoperă 28 iulie → 3 august.
    // Marțea curentă intră în raportul de săptămâna viitoare.
    expect(iso(reportWeek(new Date(2026, 7, 4)))).toEqual(["2026-07-28", "2026-08-03"]);
  });

  it("miercuri arată aceeași săptămână ca marți", () => {
    // Raportul nu se schimbă sub mână în cursul săptămânii.
    expect(iso(reportWeek(new Date(2026, 7, 5)))).toEqual(["2026-07-28", "2026-08-03"]);
  });

  it("luni arată tot săptămâna de dinainte: ziua de azi nu s-a încheiat", () => {
    // 10 august e luni. Săptămâna 4→10 august nu e completă până la miezul
    // nopții, deci raportul rămâne pe cea dinainte.
    expect(iso(reportWeek(new Date(2026, 7, 10)))).toEqual(["2026-07-28", "2026-08-03"]);
  });

  it("marțea următoare avansează exact cu șapte zile", () => {
    expect(iso(reportWeek(new Date(2026, 7, 11)))).toEqual(["2026-08-04", "2026-08-10"]);
  });

  it("intervalul are întotdeauna șapte zile", () => {
    for (let d = 1; d <= 31; d++) {
      const w = reportWeek(new Date(2026, 6, d));
      const zile = Math.round((w.to.getTime() - w.from.getTime()) / 86_400_000) + 1;
      expect(zile).toBe(7);
    }
  });

  it("începe marți și se termină luni, în orice zi ai deschide", () => {
    for (let d = 1; d <= 31; d++) {
      const w = reportWeek(new Date(2026, 6, d));
      expect(w.from.getDay()).toBe(2); // marți
      expect(w.to.getDay()).toBe(1); // luni
    }
  });

  it("navigarea nu sare și nu suprapune", () => {
    const acum = reportWeek(new Date(2026, 7, 4));
    const inainte = shiftWeek(acum, -1);
    expect(iso(inainte)).toEqual(["2026-07-21", "2026-07-27"]);
    expect(toISODate(acum.from)).toBe("2026-07-28");
    expect(iso(shiftWeek(inainte, 1))).toEqual(iso(acum));
  });

  it("trece peste marginea de an fără să se rupă", () => {
    const w = reportWeek(new Date(2027, 0, 5)); // 5 ian 2027, marți
    expect(iso(w)).toEqual(["2026-12-29", "2027-01-04"]);
  });
});

describe("săptămâna se schimbă pe calendarul Chișinăului", () => {
  const TRECUTA = ["2026-07-28", "2026-08-03"];
  const NOUA = ["2026-08-04", "2026-08-10"];
  // 21:30 UTC pe 10 august = marți 11 august, 00:30 la Chișinău. Ziua
  // prezentării a început la noi; pe ceasul serverului e încă luni seara.
  const NOAPTEA = new Date(Date.UTC(2026, 7, 10, 21, 30));

  it("luni, la 23:59 ora Chișinăului, arată încă săptămâna dinainte", () => {
    const inainte = new Date(Date.UTC(2026, 7, 10, 20, 59, 59));
    expect(iso(reportWeek(todayInChisinau(inainte)))).toEqual(TRECUTA);
  });

  it("marți, la 00:30 ora Chișinăului, arată deja săptămâna nouă", () => {
    expect(iso(reportWeek(todayInChisinau(NOAPTEA)))).toEqual(NOUA);
  });

  it("pe ceasul serverului aceeași clipă ar da săptămâna greșită", () => {
    /*
     * Greșeala reparată, scrisă ca să nu se mai întoarcă: `startOfDay` pe
     * instantul brut citește ziua de pe ceasul mașinii, iar pe Vercel mașina
     * merge pe UTC. Cine deschidea raportul marți înainte de ora 3 primea
     * cifrele săptămânii trecute, sub un subsol datat cu ziua de azi.
     */
    expect(iso(reportWeek(startOfDay(NOAPTEA)))).toEqual(TRECUTA);
  });
});

describe("săptămâna cerută prin adresă", () => {
  // Marți, 11 august 2026: săptămâna curentă a raportului e 4 → 10 august.
  const current = reportWeek(new Date(2026, 7, 11));

  it("duce înapoi exact la săptămâna din care s-a făcut legătura", () => {
    // Legăturile din pagină se scriu `?saptamana=<prima zi>`; dus-întorsul
    // trebuie să cadă pe aceleași șapte zile, altfel săgeata înapoi ar sări.
    let w = current;
    for (let i = 0; i < 6; i++) {
      w = shiftWeek(w, -1);
      expect(iso(readWeek(toISODate(w.from), current))).toEqual(iso(w));
    }
  });

  it("orice zi din săptămână duce la aceeași marți → luni", () => {
    // Un link scris de mână cu o zi de joi n-are de ce să dea eroare.
    const zile = [
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ];
    for (const zi of zile) {
      expect(iso(readWeek(zi, current))).toEqual(["2026-07-28", "2026-08-03"]);
    }
  });

  it("săptămâna curentă se poate cere explicit", () => {
    expect(iso(readWeek("2026-08-04", current))).toEqual(iso(current));
  });

  it("nu trece de săptămâna curentă", () => {
    // Marțea de azi și zilele de după ea ar deschide șapte zile care încă nu
    // s-au întâmplat — patru zerouri pe care `missingWorkdays` nu le semnalează.
    for (const zi of ["2026-08-11", "2026-08-14", "2026-08-17", "2027-03-01"]) {
      expect(iso(readWeek(zi, current))).toEqual(iso(current));
    }
  });

  it("lipsa parametrului lasă săptămâna curentă", () => {
    expect(iso(readWeek(undefined, current))).toEqual(iso(current));
    expect(iso(readWeek(null, current))).toEqual(iso(current));
    expect(iso(readWeek("", current))).toEqual(iso(current));
    expect(iso(readWeek([], current))).toEqual(iso(current));
  });

  it("o adresă stricată nu dă eroare, ci săptămâna curentă", () => {
    const gunoi = [
      "azi",
      "2026-8-4",
      "26-08-04",
      "2026/08/04",
      "2026-08-04T00:00:00",
      " 2026-08-04",
      "2026-08-04 ",
      "AAAA-LL-ZZ",
    ];
    for (const val of gunoi) {
      expect(iso(readWeek(val, current))).toEqual(iso(current));
    }
  });

  it("o zi care nu există se respinge, nu se rostogolește în luna următoare", () => {
    /*
     * Șablonul AAAA-LL-ZZ numără cifrele, nu verifică zilele: „2026-02-30"
     * trece prin el, iar V8 îl rostogolește la 2 martie. Un raport pe altă
     * săptămână decât cea scrisă în adresă, cu cifre perfect reale, n-ar avea
     * cum să fie observat — de aceea ziua se scrie la loc și se compară.
     */
    expect(iso(readWeek("2026-02-30", current))).toEqual(iso(current));
    expect(iso(readWeek("2026-04-31", current))).toEqual(iso(current));
    expect(iso(readWeek("2026-13-01", current))).toEqual(iso(current));
    expect(iso(readWeek("2026-00-10", current))).toEqual(iso(current));
    expect(iso(readWeek("2026-02-00", current))).toEqual(iso(current));
    // 2028 e bisect, 2026 nu: 29 februarie e valabil doar în primul.
    expect(iso(readWeek("2026-02-29", current))).toEqual(iso(current));
    const bisect = reportWeek(new Date(2028, 2, 10));
    expect(iso(readWeek("2028-02-29", bisect))).toEqual(["2028-02-29", "2028-03-06"]);
  });

  it("parametrul repetat dă aceeași săptămână pe ecran și în PDF", () => {
    /*
     * `?saptamana=X&saptamana=X` ajunge în pagină ca `string[]` (Next) și în
     * rută ca prima valoare (`URLSearchParams.get`). Netezirea e în `readWeek`
     * tocmai ca cele două să nu poată răspunde altceva la aceeași adresă:
     * butonul „Descarcă PDF" ar da hârtia unei alte săptămâni decât ecranul.
     */
    const adresa = new URLSearchParams("saptamana=2026-07-28&saptamana=2026-07-28");
    const pagina = readWeek(["2026-07-28", "2026-07-28"], current);
    const ruta = readWeek(adresa.get("saptamana"), current);
    expect(iso(pagina)).toEqual(["2026-07-28", "2026-08-03"]);
    expect(iso(ruta)).toEqual(iso(pagina));
  });

  it("întoarce întotdeauna șapte zile, marți → luni", () => {
    for (const val of ["2026-07-30", "azi", "", "2026-02-30", "2026-08-20"]) {
      const w = readWeek(val, current);
      expect(w.from.getDay()).toBe(2); // marți
      expect(w.to.getDay()).toBe(1); // luni
      expect(Math.round((w.to.getTime() - w.from.getTime()) / 86_400_000) + 1).toBe(7);
    }
  });
});

describe("cifrele săptămânii", () => {
  // 28 iulie → 3 august 2026, săptămâna raportului de marți 4 august.
  const week = reportWeek(new Date(2026, 7, 4));

  const gol: WeeklyRows = { transfers: [], hearings: [], releases: [] };

  it("o săptămână fără nimic dă zerouri, nu NaN", () => {
    // Registrele pot fi goale — vara, sau pur și simplu necompletate încă.
    // Un „NaN" pe hârtia dusă la conducere e mai rău decât un zero.
    expect(weeklyFigures(week, gol)).toEqual({
      plecati: 0,
      sositi: 0,
      teleconferinte: 0,
      amanate: 0,
      eliberati: 0,
    });
  });

  it("adună plecații și sosiții din transferurile săptămânii", () => {
    const figures = weeklyFigures(week, {
      ...gol,
      transfers: [
        { transfer_date: "2026-07-28", plecati: 5, sositi: 2 },
        { transfer_date: "2026-08-03", plecati: 1, sositi: 4 },
      ],
    });
    expect(figures.plecati).toBe(6);
    expect(figures.sositi).toBe(6);
  });

  it("citește teleconferințele din `tc_total`, nu le recalculează", () => {
    // `tc_total` e coloană generată în Postgres (petrecute + amânate). Rândul
    // de aici o contrazice dinadins: dacă cineva ar aduna la loc părțile, ar
    // ieși 100, nu 5. Cifra trebuie să vină din coloana bazei, ca să nu poată
    // ajunge vreodată alta decât cea din registrul de ședințe.
    const figures = weeklyFigures(week, {
      ...gol,
      hearings: [{ session_date: "2026-07-30", tc_total: 5, tc_amanate: 98 }],
    });
    expect(figures.teleconferinte).toBe(5);
  });

  it("adună amânatele separat, pentru rândul de dedesubt", () => {
    const figures = weeklyFigures(week, {
      ...gol,
      hearings: [
        { session_date: "2026-07-29", tc_total: 7, tc_amanate: 2 },
        { session_date: "2026-07-30", tc_total: 4, tc_amanate: 1 },
      ],
    });
    expect(figures.teleconferinte).toBe(11);
    expect(figures.amanate).toBe(3);
  });

  it("adună eliberările zilelor din săptămână", () => {
    const figures = weeklyFigures(week, {
      ...gol,
      releases: [
        { release_date: "2026-07-28", count: 3 },
        { release_date: "2026-08-02", count: 2 },
      ],
    });
    expect(figures.eliberati).toBe(5);
  });

  it("nu numără rândurile din afara intervalului", () => {
    // `getTransfers()` aduce registrul întreg, deci filtrarea e treaba de aici.
    // O zi de dinainte sau de după săptămână ar umfla raportul în tăcere.
    const figures = weeklyFigures(week, {
      transfers: [
        { transfer_date: "2026-07-27", plecati: 9, sositi: 9 },
        { transfer_date: "2026-08-04", plecati: 9, sositi: 9 },
      ],
      hearings: [
        { session_date: "2026-07-27", tc_total: 9, tc_amanate: 9 },
        { session_date: "2026-08-04", tc_total: 9, tc_amanate: 9 },
      ],
      releases: [
        { release_date: "2026-07-27", count: 9 },
        { release_date: "2026-08-04", count: 9 },
      ],
    });
    expect(figures).toEqual({
      plecati: 0,
      sositi: 0,
      teleconferinte: 0,
      amanate: 0,
      eliberati: 0,
    });
  });

  it("numără și prima, și ultima zi a săptămânii", () => {
    // Marțea de început și lunea de sfârșit sunt înăuntru: capetele intervalului
    // sunt exact zilele care se pierd cel mai ușor.
    const figures = weeklyFigures(week, {
      transfers: [
        { transfer_date: "2026-07-28", plecati: 1, sositi: 0 },
        { transfer_date: "2026-08-03", plecati: 1, sositi: 0 },
      ],
      hearings: [
        { session_date: "2026-07-28", tc_total: 1, tc_amanate: 0 },
        { session_date: "2026-08-03", tc_total: 1, tc_amanate: 0 },
      ],
      releases: [
        { release_date: "2026-07-28", count: 1 },
        { release_date: "2026-08-03", count: 1 },
      ],
    });
    expect(figures).toEqual({
      plecati: 2,
      sositi: 0,
      teleconferinte: 2,
      amanate: 0,
      eliberati: 2,
    });
  });
});
