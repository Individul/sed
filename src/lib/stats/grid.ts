import type { Grid } from "./types";

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim();
}

export function findCell(
  grid: Grid,
  match: (text: string) => boolean,
): { row: number; col: number } | null {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (match(cellText(row[c]))) return { row: r, col: c };
    }
  }
  return null;
}

/**
 * Normalizează un prefix de căutare la fel ca `cellText` (spații colapsate,
 * fără spațiu la început), dar **păstrează spațiul final** — acolo e
 * semnificativ: „6 " trebuie să prindă „6 Soroca", nu și „60 Chișinău".
 */
function prefixText(prefix: string): string {
  const collapsed = String(prefix ?? "").replace(/\s+/g, " ");
  return collapsed.startsWith(" ") ? collapsed.slice(1) : collapsed;
}

/** Indexul rândului a cărui primă celulă nevidă începe cu `prefix`. */
export function findRowStarting(grid: Grid, prefix: string): number | null {
  const want = prefixText(prefix).toLowerCase();
  for (let r = 0; r < grid.length; r++) {
    const first = (grid[r] ?? []).map(cellText).find((t) => t !== "") ?? "";
    if (first.toLowerCase().startsWith(want)) return r;
  }
  return null;
}

export function composeLabel(parts: (string | null | undefined)[]): string {
  return parts.map((p) => cellText(p)).filter(Boolean).join(" / ");
}

export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = cellText(v).replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
