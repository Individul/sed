// `server-only` nu e dependință în proiect, așa că importul lipsește. Modulul
// rămâne totuși strict de server: e singurul care atinge exceljs și e importat
// doar din server actions.
import ExcelJS from "exceljs";
import type { CellValue, Worksheet, Xlsx } from "exceljs";
import type { Grid } from "./types";

type GridCell = Grid[number][number];

/**
 * Scoate valoarea „curată" dintr-o celulă exceljs: formulele dau rezultatul,
 * textul bogat se concatenează, hyperlinkul dă eticheta. Datele calendaristice
 * rămân `Date`. Orice altceva (erori `#N/A`, forme necunoscute) devine `null` —
 * în grilă nu are voie să ajungă niciun obiect.
 */
function unwrap(value: CellValue): GridCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;

  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("formula" in value || "sharedFormula" in value) return unwrap(value.result ?? null);
  if ("hyperlink" in value) return unwrap(value.text);
  return null;
}

function isFilled(cell: GridCell): boolean {
  return cell !== null && String(cell).trim() !== "";
}

function filledRows(grid: Grid): number {
  return grid.filter((row) => row.some(isFilled)).length;
}

/**
 * Foaia devine o grilă densă: `grid[r][c]` e celula de pe rândul Excel r+1,
 * coloana c+1. Celulele îmbinate întorc valoarea celulei-master pe toată
 * suprafața acoperită — `cell.value` face asta din oficiu, iar parserele se
 * bazează pe ea (rândul grațierilor are valori îmbinate pe trei coloane).
 */
function sheetToGrid(sheet: Worksheet): Grid {
  const width = sheet.columnCount;
  const grid: Grid = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cells: GridCell[] = [];
    for (let c = 1; c <= width; c++) cells.push(unwrap(row.getCell(c).value));
    grid.push(cells);
  }
  return grid;
}

/**
 * Transformă un .xlsx într-o grilă de celule. Foaia aleasă e prima cu date:
 * fișierele reale pun tabelul unde nimeresc („Sheet2", „Лист2") și lasă în urmă
 * foi goale. Pragul e de două rânduri completate — un rând singur e mai
 * degrabă un titlu rătăcit decât un raport.
 */
export async function readGrid(buffer: ArrayBuffer): Promise<Grid> {
  const workbook = new ExcelJS.Workbook();
  // exceljs tipizează `load` cu `Buffer`, dar îl dă mai departe lui JSZip, care
  // primește și `ArrayBuffer` — cast îngust ca să nu copiem degeaba bufferul.
  // Tipul-țintă se ia din semnătura lui exceljs: `Buffer`-ul nostru (@types/node
  // generic) nu e același cu al lui, iar conversia n-ar trece de type-check.
  await workbook.xlsx.load(buffer as unknown as Parameters<Xlsx["load"]>[0]);

  const sheets = workbook.worksheets.map((sheet) => {
    const grid = sheetToGrid(sheet);
    return { grid, filled: filledRows(grid) };
  });

  const chosen = sheets.find((s) => s.filled > 1) ?? sheets.find((s) => s.filled > 0);
  if (!chosen) throw new Error("Fișierul nu conține nicio foaie cu date.");
  return chosen.grid;
}
