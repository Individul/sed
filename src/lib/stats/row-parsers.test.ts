import { describe, it, expect } from "vitest";
import type { Grid, StatItem, StatSeries } from "./types";
import { rowParser, ROW_PARSERS } from "./row-parsers";

/**
 * Fixturi sintetice: aceeași structură ca fișierele reale, cifre inventate.
 * Celulele îmbinate apar ca valori repetate pe toate coloanele/rândurile
 * acoperite — așa le întoarce cititorul de fișiere.
 */

const GRATIERE_TITLU =
  "Date statistice cu privire la aplicarea actului de grațiere față de condamnați de la 01.01.2026 - 30.06.2026";

/** Structura `Gratierea 2026.xlsx`: tabelul începe la B2, antet pe rândurile 1-6. */
const gratiereGrid: Grid = [
  [],
  [null, GRATIERE_TITLU, GRATIERE_TITLU, GRATIERE_TITLU, GRATIERE_TITLU, GRATIERE_TITLU],
  [],
  [null, "Penitenciar", "2026", "2026", "2026", "2026"],
  [
    null,
    "Penitenciar",
    "Total demersuri parvenite de la Aparatul Președintelui",
    "Examinați condamnați de instituția penitenciară",
    "Examinați condamnați de instituția penitenciară",
    "Examinați de către AP",
  ],
  [
    null,
    "Penitenciar",
    "Total demersuri parvenite de la Aparatul Președintelui",
    "Examinați condamnați de instituția penitenciară",
    "Examinați condamnați de instituția penitenciară",
    "grațiați",
  ],
  [null, "Penitenciarul nr. 5", 1, 1, 1, 9],
  [null, "Penitenciarul nr. 6", 8, 8, 8, 0],
  [null, "Penitenciarul nr. 7", 2, 2, 2, 2],
];

const COMISIA_TITLU =
  "Numărul persoanelor examinate la comisiile penitenciare (art.91, 92 CP) la data de 12.02.2018";
const COMISIA_SUBTITLU = "Nr. persoanelor examinate la comisia penit.";

/** Structura `Tabel_comisia_penitenciară...xlsx`: antet 1-4, sub-rând lunar. */
const comisiaGrid: Grid = [
  [COMISIA_TITLU],
  ["Penitenciar", COMISIA_SUBTITLU, COMISIA_SUBTITLU, "Admiși", "Admiși", "Eliberați"],
  ["Penitenciar", COMISIA_SUBTITLU, COMISIA_SUBTITLU, "Admiși", "Admiși", null],
  ["Penitenciar", "art. 91 CP", "art. 92 CP", "art. 91 CP", "art. 92 CP", null],
  ["Penitenciarul nr. 5", 9, 9, 9, 9],
  ["Săptămînal", 1, 1, 1, 1],
  ["Penitenciarul nr. 6", 30, 20, 5, 0],
  ["Lunar", 3, 2, 1, 0],
  ["Penitenciarul nr. 7", 7, 7, 7, 7],
  ["Săptămînal", 4, 4, 4, 4],
];

const MC_TITLU =
  "Numărul de deținuți li s-a aplicat mecanismul compensatoriu (art.473/2 și 473/3 CPP) la data de 30.06.2026";

/** Structura `MC_2026.xlsx`: antet 1-2, sub-rând lunar. */
const mcGrid: Grid = [
  [MC_TITLU, MC_TITLU, MC_TITLU, MC_TITLU],
  [
    null,
    "Eliberați din momentul primirii încheierii",
    "Eliberați după reducerea termenului",
    "Redus din termen",
  ],
  [
    null,
    "Eliberați din momentul primirii încheierii",
    "Eliberați după reducerea termenului",
    "Redus din termen",
  ],
  [
    null,
    "Eliberați din momentul primirii încheierii",
    "Eliberați după reducerea termenului",
    "Redus din termen",
  ],
  ["Penitenciarul nr. 5", 1, 2, 3],
  ["Săptămînal", 0, 0, 0],
  ["Penitenciarul nr. 6", 5, 40, 200],
  ["Lunar", 0, 8, 60],
];

const SEDINTE_TITLU =
  "Dispoziții de escortare la ședințele de judecată și acțiuni de urmărire penală la data de 01.06.2026-30.06.2026";

/** Structura `Tabel sedinte judecată...xlsx`: antet 1-3, rândul începe cu „6 ". */
const sedinteGrid: Grid = [
  [SEDINTE_TITLU, SEDINTE_TITLU, SEDINTE_TITLU, SEDINTE_TITLU, SEDINTE_TITLU, SEDINTE_TITLU],
  [
    "Penitenciarul",
    "Total",
    "Teleconferință",
    "Teleconferință",
    "Sediul penitenciarului",
    "Instanța de judecată",
  ],
  [
    "Penitenciarul",
    "Total",
    "Total ședințe",
    "Prezenți",
    "Sediul penitenciarului",
    "Total ședințe",
  ],
  ["5 Cahul", 0],
  ["60 Alt penitenciar", 11, 11, 11, 11, 11],
  ["6 Soroca", 90, 80, 70, null, 0],
  ["10 Goian", 3, 3, 3, 3, 3],
];

const junkGrid: Grid = [
  ["Factura nr. 12", "Client", "Suma"],
  ["A-1", "SRL Test", 100],
];

function get(kind: string) {
  const parser = ROW_PARSERS.find((p) => p.kind === kind);
  if (!parser) throw new Error(`Parser lipsă: ${kind}`);
  return parser;
}

function pick(items: StatItem[], fragment: string, series: StatSeries = "cumulat") {
  const hits = items.filter((i) => i.series === series && i.indicator.includes(fragment));
  if (hits.length !== 1) {
    throw new Error(`Am găsit ${hits.length} indicatori pentru „${fragment}" (${series})`);
  }
  return hits[0];
}

describe("ROW_PARSERS", () => {
  it("conține cele patru rapoarte pe rânduri", () => {
    expect(ROW_PARSERS.map((p) => p.kind)).toEqual(["gratiere", "comisia", "mc", "sedinte"]);
    for (const p of ROW_PARSERS) expect(p.label).not.toBe("");
  });
});

describe("rowParser — gratiere", () => {
  const items = get("gratiere").parse(gratiereGrid);

  it("ia rândul penitenciarului 6, nu al vecinilor", () => {
    expect(pick(items, "Total demersuri parvenite").value).toBe(8);
    expect(items.map((i) => i.value)).not.toContain(9);
    expect(items.map((i) => i.value)).not.toContain(1);
  });

  it("compune eticheta doar din cele două rânduri de antet reale", () => {
    expect(pick(items, "Total demersuri parvenite").indicator).toBe(
      "Total demersuri parvenite de la Aparatul Președintelui",
    );
    expect(pick(items, "grațiați").indicator).toBe("Examinați de către AP / grațiați");
  });

  it("nu bagă în etichete titlul cu perioada sau rândul cu anul", () => {
    for (const item of items) {
      expect(item.indicator).not.toContain(GRATIERE_TITLU);
      expect(item.indicator).not.toMatch(/\d{2}\.\d{2}\.\d{4}/);
      expect(item.indicator).not.toMatch(/\b(19|20)\d{2}\b/);
    }
  });

  it("sare peste numele penitenciarului și peste coloanele goale", () => {
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.indicator !== "")).toBe(true);
  });

  it("păstrează zerourile și marchează totul ca „cumulat” (fără sub-rând)", () => {
    expect(pick(items, "grațiați").value).toBe(0);
    expect(items.every((i) => i.series === "cumulat")).toBe(true);
  });
});

describe("rowParser — comisia", () => {
  const items = get("comisia").parse(comisiaGrid);

  it("citește rândul cumulat al penitenciarului 6", () => {
    expect(pick(items, `${COMISIA_SUBTITLU} / art. 91 CP`).value).toBe(30);
    expect(pick(items, `${COMISIA_SUBTITLU} / art. 92 CP`).value).toBe(20);
    expect(pick(items, "Admiși / art. 91 CP").value).toBe(5);
    expect(pick(items, "Admiși / art. 92 CP").value).toBe(0);
  });

  it("citește sub-rândul ca serie „perioada”, indiferent de eticheta lui", () => {
    expect(pick(items, `${COMISIA_SUBTITLU} / art. 91 CP`, "perioada").value).toBe(3);
    expect(pick(items, `${COMISIA_SUBTITLU} / art. 92 CP`, "perioada").value).toBe(2);
    expect(pick(items, "Admiși / art. 91 CP", "perioada").value).toBe(1);
    expect(pick(items, "Admiși / art. 92 CP", "perioada").value).toBe(0);
  });

  it("ia sub-rândul imediat următor chiar dacă scrie „Săptămînal”", () => {
    const saptamanal: Grid = comisiaGrid.map((row, r) =>
      r === 7 ? ["Săptămînal", 3, 2, 1, 0] : row,
    );
    const alt = get("comisia").parse(saptamanal);
    expect(pick(alt, "Admiși / art. 91 CP", "perioada").value).toBe(1);
  });

  it("nu emite coloana cu antet dar fără valori", () => {
    expect(items.some((i) => i.indicator.includes("Eliberați"))).toBe(false);
  });

  it("nu amestecă rândurile penitenciarelor vecine", () => {
    expect(items.map((i) => i.value)).not.toContain(9);
    expect(items.map((i) => i.value)).not.toContain(7);
  });
});

describe("rowParser — mc", () => {
  const items = get("mc").parse(mcGrid);

  it("compune eticheta doar din cele două rânduri de antet reale", () => {
    expect(pick(items, "Eliberați din momentul primirii încheierii").indicator).toBe(
      "Eliberați din momentul primirii încheierii",
    );
  });

  it("nu bagă în etichete titlul cu data raportării", () => {
    // Numele indicatorului ajunge în baza de date și e cheia după care se
    // leagă perioadele între ele. Cu data raportării în nume, fiecare import
    // ar aduce indicatori „noi" și nicio serie n-ar mai avea două puncte.
    for (const item of items) {
      expect(item.indicator).not.toContain(MC_TITLU);
      expect(item.indicator).not.toMatch(/\d{2}\.\d{2}\.\d{4}/);
    }
  });

  it("citește cumulat și perioada", () => {
    expect(pick(items, "Redus din termen").value).toBe(200);
    expect(pick(items, "Redus din termen", "perioada").value).toBe(60);
    expect(pick(items, "Eliberați din momentul").value).toBe(5);
    expect(pick(items, "Eliberați din momentul", "perioada").value).toBe(0);
  });

  it("emite trei indicatori × două serii", () => {
    expect(items).toHaveLength(6);
  });
});

describe("rowParser — sedinte", () => {
  const items = get("sedinte").parse(sedinteGrid);

  it("prinde „6 Soroca”, nu „60 Alt penitenciar”", () => {
    const total = items.filter((i) => i.indicator === "Total");
    expect(total).toHaveLength(1);
    expect(total[0].value).toBe(90);
    expect(items.map((i) => i.value)).not.toContain(11);
  });

  it("compune eticheta doar din cele două rânduri de antet reale", () => {
    expect(pick(items, "Teleconferință / Total ședințe").indicator).toBe(
      "Teleconferință / Total ședințe",
    );
  });

  it("nu bagă în etichete titlul cu intervalul raportat", () => {
    for (const item of items) {
      expect(item.indicator).not.toContain(SEDINTE_TITLU);
      expect(item.indicator).not.toMatch(/\d{2}\.\d{2}\.\d{4}/);
    }
  });

  it("sare peste celulele goale și păstrează zerourile", () => {
    expect(items.some((i) => i.indicator.includes("Sediul penitenciarului"))).toBe(false);
    expect(pick(items, "Instanța de judecată").value).toBe(0);
  });

  it("nu produce serie „perioada”", () => {
    expect(items.every((i) => i.series === "cumulat")).toBe(true);
  });
});

describe("rowParser — erori", () => {
  it("aruncă o eroare care numește rândul lipsă", () => {
    expect(() => get("comisia").parse(junkGrid)).toThrow(/Penitenciarul nr\. 6/);
    expect(() => get("mc").parse(junkGrid)).toThrow(/Penitenciarul nr\. 6/);
    expect(() => get("sedinte").parse(junkGrid)).toThrow(/rândul/);
  });
});

describe("rowParser — detect", () => {
  const grids: Record<string, Grid> = {
    gratiere: gratiereGrid,
    comisia: comisiaGrid,
    mc: mcGrid,
    sedinte: sedinteGrid,
  };

  it("fiecare parser câștigă pe grila lui", () => {
    for (const [kind, grid] of Object.entries(grids)) {
      const scores = ROW_PARSERS.map((p) => ({ kind: p.kind, score: p.detect(grid) }));
      const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
      expect(`${kind} -> ${best.kind}`).toBe(`${kind} -> ${kind}`);
      expect(best.score).toBeGreaterThan(0);
      for (const s of scores) {
        if (s.kind !== kind) expect(s.score).toBeLessThan(best.score);
      }
    }
  });

  it("întoarce 0 pentru o grilă fără legătură", () => {
    for (const p of ROW_PARSERS) expect(p.detect(junkGrid)).toBe(0);
  });

  it("întoarce 0 când lipsește rândul penitenciarului, chiar dacă textul se potrivește", () => {
    const faraRand: Grid = [[MC_TITLU], [null, "Redus din termen"], ["Penitenciarul nr. 5", 1]];
    expect(get("mc").detect(faraRand)).toBe(0);
  });

  it("scorul e fracțiunea de cuvinte-cheie găsite", () => {
    const parser = rowParser({
      kind: "mc",
      label: "Test",
      keywords: ["mecanismul compensatoriu", "inexistent"],
      rowPrefix: "Penitenciarul nr. 6",
      headerRows: 2,
      hasPeriodRow: true,
    });
    expect(parser.detect(mcGrid)).toBeCloseTo(0.5);
  });
});
