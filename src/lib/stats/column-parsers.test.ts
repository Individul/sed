import { describe, it, expect } from "vitest";
import type { Grid } from "./types";
import { columnParser, COLUMN_PARSERS } from "./column-parsers";

/**
 * Fixturi sintetice: aceeași structură ca fișierele reale, cifre inventate.
 * Celulele îmbinate (merged) sunt reproduse ca valori repetate pe toate
 * coloanele/rândurile acoperite — așa le întoarce cititorul de fișiere.
 */

/** Structura `01.06.2026_r_lunar.xlsx`: antet pe rândul 3, P-6 pe coloana 7. */
const rLunarGrid: Grid = [
  ["Raport privind numărul persoanelor deţinute", null, null, null, null, null, null],
  ["(la 29 ianuarie 2018, ora 8.00)", new Date("2026-06-30T00:00:00Z"), null, null, null, null, null],
  [null, null, "P-1", "P-2", "P-3", "P-4", "P-6", "P-7", "Total"],
  ["Plafonul de detenție", "Plafonul de detenție", 111, 222, 333, 444, 900, 555, 2565],
  ["Persoane deținute", "Persoane deținute", null, null, null, null, 890, null, null],
  ["Suprapopularea", "Suprapopularea", null, null, null, null, -10, null, null],
  ["Din ei:", "Femei", null, null, null, null, 0, null, null],
  ["Din ei:", "Minori", null, null, null, null, null, null, null],
  ["LIBERAȚI", "Total", null, null, null, null, 42, null, null],
  ["LIBERAȚI", "Lunar", null, null, null, null, 7, null, null],
  [null, "Săptămînal", null, null, null, null, 3, null, null],
  [null, null, null, null, null, null, 99, null, null],
];

/** Structura `01.06.2026_liberați.xlsx`: antet pe rândul 7, P-6 pe coloana 7. */
const liberatiGrid: Grid = [
  [],
  [],
  [null, null, null, null, null, null, null, null, "Date statistice"],
  [null, null, null, null, null, null, null, null, "privind liberarea deținuților din penitenciare la data de _______"],
  [],
  [],
  ["Liberați Condamnați", "P-1", "P-2", "P-3", "P-4", "P-5", "P-6", "P-7", "Total"],
  ["La executarea integrală a termenului de pedeapsă", 0, 0, 0, 0, 0, 12, 0, 12],
  ["Art. 473/2 alin. (3) CPP (compensat, condiții de detenție)", 0, 0, 0, 0, 0, 34, null, 34],
  ["Total liberați condamnați", 0, 0, 0, 0, 0, 46, 0, 46],
  ["Liberați Preveniți"],
  ["Total liberați deținuți", 0, 0, 0, 0, 0, 49, 0, 49],
];

/** Structura `Amnistia_2016_01.06.2026.xlsx`: antet pe rândul 5, P-6 pe coloana 11. */
const amnistia2016Grid: Grid = [
  ["Date statistice privind aplicarea"],
  ["Legii nr. 210 din 29 iulie 2016 privind amnistia"],
  ["la data de 30.06.2023", new Date("2024-03-31T00:00:00Z")],
  [],
  [null, null, null, null, null, "P-1", "P-2", "P-3", "P-4", "P-5", "P-6", "P-7", "Total"],
  ["Nr. condamnaților care cad sub incideța actului amnistiei", "Nr. condamnaților care cad sub incideța actului amnistiei", "Nr. condamnaților care cad sub incideța actului amnistiei", "Nr. condamnaților care cad sub incideța actului amnistiei", "Nr. condamnaților care cad sub incideța actului amnistiei", null, null, null, null, null, 500],
  ["Materiale examinate la comisia penitenciarului", "Materiale examinate la comisia penitenciarului", "Total", "Total", "Total", null, null, null, null, null, 600],
  ["Materiale examinate la comisia penitenciarului", "Materiale examinate la comisia penitenciarului", "Refuzați", "Refuzați", "Refuzați", null, null, null, null, null, 20],
  ["Demersurile penitenciarului", "Total art. 13", "Total art. 13", "Total art. 13", "Total art. 13", null, null, null, null, null, 400],
  ["Demersurile penitenciarului", "Art. 13", "Art. 13", "lit. a)", "lit. a)", null, null, null, null, null, 0],
  ["Demersurile penitenciarului", "Art. 13", "Art. 13", "lit. b)", "lit. b)"],
];

/** Structura `Amnistia_2021_01.06.2026.xlsx`: antet pe rândul 1, P-6 = singura coloană. */
const amnistia2021Grid: Grid = [
  [null, null, null, null, "P-6"],
  ["Materiale examinate la Comisia specială", "Materiale examinate la Comisia specială", "Materiale examinate la Comisia specială", "Total", 400],
  ["Materiale examinate la Comisia specială", "Materiale examinate la Comisia specială", "Materiale examinate la Comisia specială", "Admiși", 150],
  ["Materiale examinate la Comisia specială", "Materiale examinate la Comisia specială", "Materiale examinate la Comisia specială", "Refuzați", 250],
  ["Demersurile penitenciarului", "Total conform art.7 alin.(1)", "Total conform art.7 alin.(1)", "Total conform art.7 alin.(1)", 150],
  ["Demersurile penitenciarului", "Art.7 alin.(1)", "Art.7 alin.(1)", "lit.a)", 0],
  ["Demersurile penitenciarului", "Art.7 alin.(1)", "Art.7 alin.(1)", "lit.b)"],
];

const junkGrid: Grid = [
  ["Factura nr. 12", "Client", "Suma"],
  ["A-1", "SRL Test", 100],
];

function get(kind: string) {
  const parser = COLUMN_PARSERS.find((p) => p.kind === kind);
  if (!parser) throw new Error(`Parser lipsă: ${kind}`);
  return parser;
}

function valueOf(items: { indicator: string; value: number | null }[], indicator: string) {
  return items.find((i) => i.indicator === indicator)?.value;
}

describe("COLUMN_PARSERS", () => {
  it("conține cele patru rapoarte pe coloane", () => {
    expect(COLUMN_PARSERS.map((p) => p.kind)).toEqual([
      "r_lunar",
      "liberati",
      "amnistia_2016",
      "amnistia_2021",
    ]);
    for (const p of COLUMN_PARSERS) expect(p.label).not.toBe("");
  });
});

describe("columnParser — r_lunar", () => {
  const items = get("r_lunar").parse(rLunarGrid);

  it("ia valorile din coloana P-6, nu din alta", () => {
    expect(valueOf(items, "Plafonul de detenție")).toBe(900);
    expect(valueOf(items, "Persoane deținute")).toBe(890);
    expect(valueOf(items, "Suprapopularea")).toBe(-10);
    expect(valueOf(items, "LIBERAȚI / Total")).toBe(42);
  });

  it("compune etichete ierarhice din coloanele dinaintea primei coloane P-\\d+", () => {
    expect(items.map((i) => i.indicator)).toContain("LIBERAȚI / Lunar");
    expect(items.map((i) => i.indicator)).toContain("Din ei: / Femei");
  });

  it("colapsează eticheta repetată de celulele îmbinate", () => {
    expect(items.map((i) => i.indicator)).toContain("Plafonul de detenție");
    expect(items.map((i) => i.indicator)).not.toContain(
      "Plafonul de detenție / Plafonul de detenție",
    );
  });

  it("păstrează zerourile și sare peste celulele goale", () => {
    expect(valueOf(items, "Din ei: / Femei")).toBe(0);
    expect(items.map((i) => i.indicator)).not.toContain("Din ei: / Minori");
  });

  it("sare peste rândurile fără etichetă", () => {
    expect(items.every((i) => i.indicator !== "")).toBe(true);
    expect(items.map((i) => i.value)).not.toContain(99);
  });

  it("marchează toate valorile ca serie „cumulat”", () => {
    expect(items.every((i) => i.series === "cumulat")).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });
});

describe("columnParser — liberati", () => {
  const items = get("liberati").parse(liberatiGrid);

  it("folosește o singură coloană de etichetă", () => {
    expect(valueOf(items, "La executarea integrală a termenului de pedeapsă")).toBe(12);
    expect(valueOf(items, "Art. 473/2 alin. (3) CPP (compensat, condiții de detenție)")).toBe(34);
    expect(valueOf(items, "Total liberați condamnați")).toBe(46);
    expect(valueOf(items, "Total liberați deținuți")).toBe(49);
  });

  it("ignoră rândurile-titlu fără valori", () => {
    expect(items.map((i) => i.indicator)).not.toContain("Liberați Preveniți");
  });
});

describe("columnParser — amnistia_2016", () => {
  const items = get("amnistia_2016").parse(amnistia2016Grid);

  it("ia coloana 11 și compune eticheta din primele cinci coloane", () => {
    expect(valueOf(items, "Nr. condamnaților care cad sub incideța actului amnistiei")).toBe(500);
    expect(valueOf(items, "Materiale examinate la comisia penitenciarului / Total")).toBe(600);
    expect(valueOf(items, "Materiale examinate la comisia penitenciarului / Refuzați")).toBe(20);
    expect(valueOf(items, "Demersurile penitenciarului / Total art. 13")).toBe(400);
    expect(valueOf(items, "Demersurile penitenciarului / Art. 13 / lit. a)")).toBe(0);
  });

  it("nu emite rânduri fără valoare în P-6", () => {
    expect(items.map((i) => i.indicator)).not.toContain(
      "Demersurile penitenciarului / Art. 13 / lit. b)",
    );
  });
});

describe("columnParser — amnistia_2021 (P-6 e singura coloană de penitenciar)", () => {
  const items = get("amnistia_2021").parse(amnistia2021Grid);

  it("tratează toate coloanele dinaintea lui P-6 ca etichetă", () => {
    expect(valueOf(items, "Materiale examinate la Comisia specială / Total")).toBe(400);
    expect(valueOf(items, "Materiale examinate la Comisia specială / Admiși")).toBe(150);
    expect(valueOf(items, "Materiale examinate la Comisia specială / Refuzați")).toBe(250);
    expect(valueOf(items, "Demersurile penitenciarului / Total conform art.7 alin.(1)")).toBe(150);
    expect(valueOf(items, "Demersurile penitenciarului / Art.7 alin.(1) / lit.a)")).toBe(0);
  });

  it("nu include valoarea din antet ca indicator", () => {
    expect(items.every((i) => i.value !== null)).toBe(true);
    expect(items.every((i) => i.series === "cumulat")).toBe(true);
  });
});

describe("columnParser — erori", () => {
  it("aruncă o eroare care menționează P-6 când coloana lipsește", () => {
    const parser = get("r_lunar");
    expect(() => parser.parse(junkGrid)).toThrow(/P-6/);
  });
});

describe("columnParser — detect", () => {
  const grids: Record<string, Grid> = {
    r_lunar: rLunarGrid,
    liberati: liberatiGrid,
    amnistia_2016: amnistia2016Grid,
    amnistia_2021: amnistia2021Grid,
  };

  it("fiecare parser câștigă pe grila lui", () => {
    for (const [kind, grid] of Object.entries(grids)) {
      const scores = COLUMN_PARSERS.map((p) => ({ kind: p.kind, score: p.detect(grid) }));
      const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
      expect(`${kind} -> ${best.kind}`).toBe(`${kind} -> ${kind}`);
      expect(best.score).toBeGreaterThan(0);
      for (const s of scores) {
        if (s.kind !== kind) expect(s.score).toBeLessThan(best.score);
      }
    }
  });

  it("întoarce 0 pentru o grilă fără legătură", () => {
    for (const p of COLUMN_PARSERS) expect(p.detect(junkGrid)).toBe(0);
  });

  it("întoarce 0 când lipsește coloana P-6, chiar dacă textul se potrivește", () => {
    const fara: Grid = [
      ["Raport privind numărul persoanelor deţinute"],
      ["Plafonul de detenție", 100],
    ];
    expect(get("r_lunar").detect(fara)).toBe(0);
  });

  it("întoarce 0 când există P-6 dar niciun cuvânt-cheie", () => {
    const doarP6: Grid = [["Alt raport"], [null, "P-6"], ["Ceva", 1]];
    expect(get("r_lunar").detect(doarP6)).toBe(0);
  });

  it("nu confundă un număr precum 1210 cu Legea nr. 210", () => {
    const altRaport: Grid = [
      ["Raport oarecare", 1210],
      [null, "P-6"],
      ["Indicator", 1],
    ];
    expect(get("amnistia_2016").detect(altRaport)).toBeLessThan(1);
    expect(get("amnistia_2016").detect(amnistia2016Grid)).toBe(1);
  });

  it("scorul e fracțiunea de cuvinte-cheie găsite", () => {
    const parser = columnParser("r_lunar", "Test", ["plafonul", "inexistent"]);
    expect(parser.detect(rLunarGrid)).toBeCloseTo(0.5);
  });
});
