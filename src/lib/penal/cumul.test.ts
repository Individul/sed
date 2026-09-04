import { describe, expect, it } from "vitest";
import { lantulTemeiurilor, temeiCumul } from "./cumul";

const d = (iso: string) => new Date(`${iso}T12:00:00`);

describe("art. 84 alin. (4) sau art. 85", () => {
  it("fapta dinaintea primei sentințe e concurs de infracțiuni", () => {
    // Art. 84 alin. (4): „săvârșite înainte de pronunţarea sentinţei în prima
    // cauză". Nu contează că a doua sentință vine mult mai târziu.
    const r = temeiCumul({ savarsire: d("2024-03-10"), pronuntare: d("2025-06-01") });
    expect(r.temei).toBe("art84");
  });

  it("fapta de după prima sentință e cumul de sentințe", () => {
    const r = temeiCumul({
      savarsire: d("2025-09-15"),
      pronuntare: d("2025-06-01"),
      sfarsitPrimei: d("2028-06-01"),
    });
    expect(r.temei).toBe("art85");
  });

  it("fapta de după executarea completă nu e nici una, nici alta", () => {
    // Art. 85 cere ca fapta să fie săvârșită „înainte de executarea completă a
    // pedepsei". După, e o cauză de sine stătătoare.
    const r = temeiCumul({
      savarsire: d("2028-07-01"),
      pronuntare: d("2025-06-01"),
      sfarsitPrimei: d("2028-06-01"),
    });
    expect(r.temei).toBe("niciunul");
  });

  it("fapta din chiar ultima zi de executare e tot cumul de sentințe", () => {
    // Ziua se socotește executată abia la sfârșitul ei.
    const r = temeiCumul({
      savarsire: d("2028-06-01"),
      pronuntare: d("2025-06-01"),
      sfarsitPrimei: d("2028-06-01"),
    });
    expect(r.temei).toBe("art85");
  });

  it("fără sfârșitul primei pedepse, răspunsul rămâne art. 85", () => {
    // Sub condiția, spusă pe ecran, că pedeapsa nu era executată integral: e tot
    // ce se poate ști din datele avute.
    const r = temeiCumul({ savarsire: d("2025-09-15"), pronuntare: d("2025-06-01") });
    expect(r.temei).toBe("art85");
  });

  it("fapta din ziua pronunțării se semnalează, nu se hotărăște singură", () => {
    // „Înainte" și „după" se despart la ora citirii sentinței, iar data nu o
    // conține. Un răspuns dat fără ezitare aici ar fi o ghicitoare cu aer de
    // socoteală.
    const r = temeiCumul({ savarsire: d("2025-06-01"), pronuntare: d("2025-06-01") });
    expect(r.aceeasiZi).toBe(true);
    expect(r.temei).toBe("art85");
  });

  it("în orice altă zi nu se semnalează nimic", () => {
    expect(temeiCumul({ savarsire: d("2025-05-31"), pronuntare: d("2025-06-01") }).aceeasiZi)
      .toBe(false);
    expect(temeiCumul({ savarsire: d("2025-06-02"), pronuntare: d("2025-06-01") }).aceeasiZi)
      .toBe(false);
  });

  it("ora din date nu schimbă răspunsul", () => {
    // Câmpurile de dată dau miezul nopții, dar o dată venită din altă parte
    // poate purta orice oră; ziua trebuie să hotărască, nu ceasul.
    const r = temeiCumul({
      savarsire: new Date("2025-06-01T23:30:00"),
      pronuntare: new Date("2025-06-01T00:10:00"),
    });
    expect(r.aceeasiZi).toBe(true);
  });
});

describe("lanțul de sentințe", () => {
  const s = (pronuntare: string, savarsire: string, sfarsit?: string) => ({
    pronuntare: d(pronuntare),
    savarsire: d(savarsire),
    sfarsit: sfarsit ? d(sfarsit) : null,
  });

  it("cazul din dosar: fapta de după prima sentință e cumul, oricâte sentințe ar fi între", () => {
    // Patru sentințe reale. Fapta din sentința 4 (05.08.2024) e săvârșită după
    // pronunțarea sentinței 1 (17.07.2024) — cu trei săptămâni. Că e înainte de
    // sentințele 2 și 3 nu schimbă nimic: omul era deja condamnat.
    const pasi = lantulTemeiurilor([
      s("2024-07-17", "2022-10-21"),
      s("2025-01-22", "2021-06-20"),
      s("2025-02-12", "2024-06-30"),
      s("2026-02-06", "2024-08-05"),
    ]);
    expect(pasi.map((p) => p.temei)).toEqual(["art84", "art84", "art85"]);
  });

  it("ancora e prima sentință, nu cea dinaintea fiecăreia", () => {
    // Fapta a treia e săvârșită între sentințele 1 și 2. Față de a doua ar părea
    // concurs, dar art. 84 alin. (4) vorbește de „sentinţa în prima cauză", iar
    // la 01.09.2025 omul era condamnat de opt luni.
    const pasi = lantulTemeiurilor([
      s("2025-01-01", "2024-05-10"),
      s("2026-06-01", "2025-03-01"),
      s("2027-03-01", "2025-09-01"),
    ]);
    expect(pasi.map((p) => p.temei)).toEqual(["art85", "art85"]);
  });

  it("le pune în ordinea pronunțării, oricum ar fi introduse", () => {
    // Din dosar ies în ordinea în care s-au găsit, nu a calendarului.
    const pasi = lantulTemeiurilor([
      s("2026-02-06", "2024-08-05"),
      s("2024-07-17", "2022-10-21"),
      s("2025-02-12", "2024-06-30"),
    ]);
    expect(pasi.map((p) => p.numar)).toEqual([2, 3]);
    expect(pasi.map((p) => p.temei)).toEqual(["art84", "art85"]);
  });

  it("prima sentință n-are treaptă a ei", () => {
    // Nu e nimic de cumulat cu ea; treptele încep de la a doua.
    expect(lantulTemeiurilor([s("2025-01-01", "2024-05-10")])).toEqual([]);
    expect(lantulTemeiurilor([])).toEqual([]);
  });

  it("un lanț întreg de concursuri rămâne concurs la fiecare treaptă", () => {
    const pasi = lantulTemeiurilor([
      s("2025-01-01", "2024-01-10"),
      s("2025-06-01", "2024-02-10"),
      s("2026-01-01", "2024-03-10"),
    ]);
    expect(pasi.map((p) => p.temei)).toEqual(["art84", "art84"]);
  });

  it("executarea completă se cântărește față de pedeapsa din acel moment, nu de prima", () => {
    // Pedeapsa din sentința 1 se încheiase în 2025, dar omul executa pedeapsa
    // din sentința 2 până în 2029. O faptă din 2027 e tot cumul de sentințe.
    const pasi = lantulTemeiurilor([
      s("2024-01-01", "2023-05-10", "2025-01-01"),
      s("2024-06-01", "2023-06-10", "2029-01-01"),
      s("2028-03-01", "2027-06-01"),
    ]);
    expect(pasi.map((p) => p.temei)).toEqual(["art84", "art85"]);
    expect(pasi[1].numarInExecutare).toBe(2);
  });

  it("fapta de după executarea completă nu e nici concurs, nici cumul", () => {
    const pasi = lantulTemeiurilor([
      s("2024-01-01", "2023-05-10", "2025-01-01"),
      s("2026-03-01", "2025-06-01"),
    ]);
    expect(pasi.map((p) => p.temei)).toEqual(["niciunul"]);
    expect(pasi[0].numarInExecutare).toBe(1);
  });

  it("fapta datată după propria sentință se semnalează", () => {
    // Nu se poate ști care dintre cele două date e greșită, deci nu se
    // corectează nimic — se arată.
    const pasi = lantulTemeiurilor([
      s("2025-01-01", "2024-05-10"),
      s("2026-06-01", "2027-01-01"),
    ]);
    expect(pasi[0].dataImposibila).toBe(true);
  });
});
