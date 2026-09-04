import type { Grid, StatItem, StatKind, StatParser } from "./types";
import { cellText, findCell, toNumber } from "./grid";
import { detectScore, labelFromParts } from "./parser-utils";

const PEN_HEADER = /^P-\d+$/;

/**
 * Rapoarte „pe coloane": fiecare penitenciar are o coloană, indicatorii stau
 * pe rânduri. Se caută celula `P-6`; etichetele vin din coloanele dinaintea
 * primei coloane de penitenciar din același rând de antet.
 */
export function columnParser(
  kind: StatKind,
  label: string,
  keywords: string[],
): StatParser {
  return {
    kind,
    label,
    detect(grid: Grid): number {
      if (!findCell(grid, (t) => t === "P-6")) return 0;
      return detectScore(grid, keywords);
    },
    parse(grid: Grid): StatItem[] {
      const head = findCell(grid, (t) => t === "P-6");
      if (!head) throw new Error("Nu am găsit coloana P-6 în fișier.");

      const headerRow = grid[head.row] ?? [];
      let firstPenCol = head.col;
      for (let c = 0; c < headerRow.length; c++) {
        if (PEN_HEADER.test(cellText(headerRow[c]))) {
          firstPenCol = c;
          break;
        }
      }

      const items: StatItem[] = [];
      for (let r = head.row + 1; r < grid.length; r++) {
        const row = grid[r] ?? [];
        const indicator = labelFromParts(row.slice(0, firstPenCol));
        const value = toNumber(row[head.col]);
        if (indicator === "" || value === null) continue;
        items.push({ indicator, series: "cumulat", value });
      }
      return items;
    },
  };
}

export const COLUMN_PARSERS: StatParser[] = [
  columnParser("r_lunar", "Raport lunar (situația deținuților)", [
    "deţinute",
    "plafonul",
  ]),
  columnParser("liberati", "Liberări din penitenciar", [
    "liberarea deținuților",
  ]),
  // „210" singur ar prinde și un simplu număr (1210) dintr-un raport străin.
  columnParser("amnistia_2016", "Amnistia 2016 (Legea nr. 210)", [
    "210",
    "amnistia",
  ]),
  columnParser("amnistia_2021", "Amnistia 2021", ["comisia specială"]),
];
