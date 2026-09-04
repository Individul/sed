import type { Grid, StatKind, StatParser } from "./types";
import { COLUMN_PARSERS } from "./column-parsers";
import { ROW_PARSERS } from "./row-parsers";

/** Toate cele opt rapoarte. Ordinea e și ordinea de departajare la egalitate. */
export const PARSERS: StatParser[] = [...COLUMN_PARSERS, ...ROW_PARSERS];

export function parserFor(kind: StatKind): StatParser | null {
  return PARSERS.find((parser) => parser.kind === kind) ?? null;
}

export interface ParserMatch {
  parser: StatParser;
  score: number;
}

/**
 * Parserul cu scorul cel mai mare, dacă trece de `minScore`. Sub prag întoarce
 * `null`: mai bine îl întrebăm pe utilizator ce fișier a încărcat decât să
 * citim un raport străin cu parserul greșit. Scorul 0 e refuzul explicit al
 * parserului („nu-mi găsesc coloana/rândul"), deci nu câștigă nici cu pragul 0.
 */
export function detectParser(grid: Grid, minScore = 0.5): ParserMatch | null {
  let best: ParserMatch | null = null;
  for (const parser of PARSERS) {
    const score = parser.detect(grid);
    if (score <= 0 || score < minScore) continue;
    if (best === null || score > best.score) best = { parser, score };
  }
  return best;
}
