import { describe, it, expect } from "vitest";
import type { Grid, StatKind } from "./types";
import { PARSERS, parserFor, detectParser } from "./registry";

/** Fixturi sintetice minimale: doar cât să recunoască fiecare parser raportul lui. */

const grids: Record<StatKind, Grid> = {
  r_lunar: [
    ["Raport privind numărul persoanelor deţinute"],
    [null, null, "P-6", "Total"],
    ["Plafonul de detenție", null, 900, 900],
  ],
  liberati: [
    ["Date statistice privind liberarea deținuților din penitenciare"],
    ["Liberați Condamnați", "P-6", "Total"],
    ["Total liberați condamnați", 46, 46],
  ],
  amnistia_2016: [
    ["Legii nr. 210 din 29 iulie 2016 privind amnistia"],
    [null, "P-6", "Total"],
    ["Materiale examinate la comisia penitenciarului", 600, 600],
  ],
  amnistia_2021: [
    [null, null, "P-6"],
    ["Materiale examinate la Comisia specială", "Total", 462],
    ["Materiale examinate la Comisia specială", "Admiși", 181],
  ],
  gratiere: [
    [null, "Date statistice cu privire la aplicarea actului de grațiere"],
    [],
    [],
    [],
    [null, "Penitenciar", "Total demersuri parvenite de la Aparatul Președintelui"],
    [null, "Penitenciar", "Total demersuri parvenite de la Aparatul Președintelui"],
    [null, "Penitenciarul nr. 6", 5],
  ],
  comisia: [
    ["Numărul persoanelor examinate la comisiile penitenciare (art.91, 92 CP)"],
    ["Penitenciar", "Nr. persoanelor examinate la comisia penit."],
    ["Penitenciar", "art. 91 CP"],
    ["Penitenciar", "art. 92 CP"],
    ["Penitenciarul nr. 6", 35, 31],
    ["Lunar", 4, 4],
  ],
  mc: [
    ["Numărul de deținuți cărora li s-a aplicat mecanismul compensatoriu"],
    [null, "Redus din termen"],
    ["Penitenciarul nr. 6", 306],
    ["Lunar", 70],
  ],
  sedinte: [
    ["Dispoziții de escortare la ședințele de judecată"],
    ["Penitenciarul", "Total", "Teleconferință"],
    ["Penitenciarul", "Total", "Total ședințe"],
    ["6 Soroca", 107, 103],
  ],
};

const KINDS = Object.keys(grids) as StatKind[];

const junkGrid: Grid = [
  ["Factura nr. 12", "Client", "Suma"],
  ["A-1", "SRL Test", 100],
];

/** Doar unul din cele două cuvinte-cheie ale lui `r_lunar` → scor 0.5. */
const jumatateGrid: Grid = [[null, "P-6"], ["Plafonul de detenție", 900]];

describe("PARSERS", () => {
  it("adună cele opt rapoarte, întâi cele pe coloane", () => {
    expect(PARSERS.map((p) => p.kind)).toEqual([
      "r_lunar",
      "liberati",
      "amnistia_2016",
      "amnistia_2021",
      "gratiere",
      "comisia",
      "mc",
      "sedinte",
    ]);
  });

  it("nu are două parsere pentru același tip", () => {
    expect(new Set(PARSERS.map((p) => p.kind)).size).toBe(PARSERS.length);
  });
});

describe("parserFor", () => {
  it("găsește parserul fiecăruia dintre cele opt tipuri", () => {
    for (const kind of KINDS) {
      expect(parserFor(kind)?.kind).toBe(kind);
    }
  });

  it("întoarce null pentru un tip necunoscut", () => {
    // Cast pentru a simula o valoare venită din afara aplicației (ex. din baza de date).
    expect(parserFor("altceva" as StatKind)).toBeNull();
  });
});

describe("detectParser", () => {
  it("alege parserul potrivit pentru fiecare raport", () => {
    for (const kind of KINDS) {
      const match = detectParser(grids[kind]);
      expect(`${kind} -> ${match?.parser.kind}`).toBe(`${kind} -> ${kind}`);
      expect(match?.score).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("întoarce null pentru un fișier fără legătură", () => {
    expect(detectParser(junkGrid)).toBeNull();
  });

  it("întoarce null pentru o grilă goală", () => {
    expect(detectParser([])).toBeNull();
  });

  it("acceptă scorul egal cu pragul, dar nu și sub el", () => {
    const match = detectParser(jumatateGrid);
    expect(match?.parser.kind).toBe("r_lunar");
    expect(match?.score).toBeCloseTo(0.5);
    expect(detectParser(jumatateGrid, 0.6)).toBeNull();
  });

  it("respectă un prag coborât", () => {
    expect(detectParser(jumatateGrid, 0)?.parser.kind).toBe("r_lunar");
    expect(detectParser(junkGrid, 0)).toBeNull();
  });
});
