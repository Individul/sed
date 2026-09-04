import type { Grid, StatItem, StatKind, StatParser } from "./types";
import { findRowStarting, toNumber } from "./grid";
import { detectScore, labelFromParts } from "./parser-utils";

export interface RowParserConfig {
  kind: StatKind;
  label: string;
  /** Cuvinte-cheie căutate în antet (comparate cu minuscule). */
  keywords: string[];
  /** Prefixul primei celule nevide de pe rândul penitenciarului 6. */
  rowPrefix: string;
  /**
   * De la ce rând (0-based) începe antetul. Implicit 0. Se setează când
   * deasupra antetului stau rânduri dependente de perioadă (titlul cu
   * intervalul de raportare, rândul cu anul) — acelea ar schimba numele
   * indicatorilor la fiecare import și ar rupe comparația între perioade.
   */
  headerFrom?: number;
  /** Câte rânduri, începând cu `headerFrom`, formează antetul. */
  headerRows: number;
  /**
   * Rândul imediat următor conține valorile pe perioadă. Eticheta lui diferă
   * de la un penitenciar la altul („Lunar" / „Săptămînal"), deci se ia mereu
   * rândul următor, fără să i se citească textul.
   */
  hasPeriodRow: boolean;
}

/**
 * Rapoarte „pe rânduri": fiecare penitenciar are un rând, indicatorii stau pe
 * coloane și se compun din primele `headerRows` rânduri.
 */
export function rowParser(config: RowParserConfig): StatParser {
  const { kind, label, keywords, rowPrefix, headerRows, hasPeriodRow } = config;
  const headerFrom = config.headerFrom ?? 0;

  return {
    kind,
    label,
    detect(grid: Grid): number {
      if (findRowStarting(grid, rowPrefix) === null) return 0;
      return detectScore(grid, keywords, headerFrom + headerRows);
    },
    parse(grid: Grid): StatItem[] {
      const penRow = findRowStarting(grid, rowPrefix);
      if (penRow === null) {
        throw new Error(`Nu am găsit rândul „${rowPrefix.trim()}” în fișier.`);
      }

      const header = grid
        .slice(headerFrom, headerFrom + headerRows)
        .map((row) => row ?? []);
      const values = grid[penRow] ?? [];
      const period = hasPeriodRow ? grid[penRow + 1] ?? [] : [];
      const width = Math.max(
        values.length,
        period.length,
        ...header.map((row) => row.length),
      );

      const items: StatItem[] = [];
      for (let c = 0; c < width; c++) {
        const indicator = labelFromParts(header.map((row) => row[c]));
        if (indicator === "") continue;

        const cumulat = toNumber(values[c]);
        if (cumulat !== null) {
          items.push({ indicator, series: "cumulat", value: cumulat });
        }
        if (!hasPeriodRow) continue;

        const perioada = toNumber(period[c]);
        if (perioada !== null) {
          items.push({ indicator, series: "perioada", value: perioada });
        }
      }
      return items;
    },
  };
}

export const ROW_PARSERS: StatParser[] = [
  rowParser({
    kind: "gratiere",
    label: "Grațiere",
    keywords: ["grațiere", "demersuri parvenite"],
    rowPrefix: "Penitenciarul nr. 6",
    // Rândurile Excel 1-4 conțin titlul cu intervalul raportat și anul, deci
    // antetul util e format doar din rândurile 5 și 6.
    headerFrom: 4,
    headerRows: 2,
    hasPeriodRow: false,
  }),
  rowParser({
    kind: "comisia",
    label: "Comisia penitenciară (art. 91, 92 CP)",
    keywords: ["comisiile penitenciare", "art. 91 cp"],
    rowPrefix: "Penitenciarul nr. 6",
    headerRows: 4,
    hasPeriodRow: true,
  }),
  rowParser({
    kind: "mc",
    label: "Mecanismul compensatoriu (art. 473/2, 473/3 CPP)",
    keywords: ["mecanismul compensatoriu", "redus din termen"],
    rowPrefix: "Penitenciarul nr. 6",
    // Rândul Excel 1 e titlul „…la data de 30.06.2026", deci antetul util e
    // doar rândul 2. Fără asta, data raportării intra în numele fiecărui
    // indicator și niciun indicator nu s-ar fi repetat de la o lună la alta.
    headerFrom: 1,
    headerRows: 2,
    hasPeriodRow: true,
  }),
  rowParser({
    kind: "sedinte",
    label: "Ședințe de judecată și acțiuni de urmărire penală",
    keywords: ["dispoziții de escortare", "teleconferință"],
    rowPrefix: "6 ",
    // La fel ca la mecanismul compensatoriu: rândul 1 poartă intervalul
    // raportat. În plus, titlul lui nu acoperea toate coloanele, așa că unii
    // indicatori îl primeau în nume și alții nu.
    headerFrom: 1,
    headerRows: 2,
    hasPeriodRow: false,
  }),
];
