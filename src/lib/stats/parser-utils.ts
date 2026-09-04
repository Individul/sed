import type { Grid } from "./types";
import { cellText, composeLabel } from "./grid";

/** Câte rânduri de la începutul grilei se scanează pentru cuvintele-cheie. */
const DETECT_ROWS = 8;

/**
 * Compune eticheta unui indicator din bucățile de antet, colapsând repetările
 * consecutive. Celulele îmbinate din Excel apar ca aceeași valoare pe toate
 * coloanele/rândurile acoperite („Plafonul de detenție” pe A și B), iar fără
 * colapsare eticheta ar deveni „Plafonul de detenție / Plafonul de detenție”.
 */
export function labelFromParts(parts: unknown[]): string {
  const kept: string[] = [];
  for (const part of parts) {
    const text = cellText(part);
    if (text === "" || text === kept[kept.length - 1]) continue;
    kept.push(text);
  }
  return composeLabel(kept);
}

/**
 * Fracțiunea de cuvinte-cheie găsite în antetul grilei (0..1). `minRows`
 * garantează că se scanează cel puțin întreg antetul raportului.
 */
export function detectScore(
  grid: Grid,
  keywords: string[],
  minRows = 0,
): number {
  if (keywords.length === 0) return 0;
  const haystack = grid
    .slice(0, Math.max(DETECT_ROWS, minRows))
    .flatMap((row) => (row ?? []).map(cellText))
    .join(" ")
    .toLowerCase();
  const hits = keywords.filter((k) => haystack.includes(k.toLowerCase())).length;
  return hits / keywords.length;
}
