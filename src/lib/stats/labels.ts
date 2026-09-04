import { PARSERS } from "./registry";
import type { PeriodType } from "./period";
import type { StatKind, StatSeries } from "./types";

/**
 * Etichetele omenești ale statisticilor, într-un singur loc: dialogul de import,
 * lista de rapoarte și graficul spun toate la fel.
 *
 * Modulul e sigur pentru client — `registry` ajunge la parsere, iar acelea ating
 * doar grile în memorie; singurul modul care încarcă exceljs e `workbook`.
 */

/**
 * Tipurile de raport, în ordinea din registru — sursa numelor din interfață și
 * singura listă din care selectorul de tip poate alege. `kind` e `StatKind`, ca
 * valoarea aleasă să ajungă la server îngustată, nu convertită cu forța.
 */
export const KIND_OPTIONS: { kind: StatKind; label: string }[] = PARSERS.map((parser) => ({
  kind: parser.kind,
  label: parser.label,
}));

const LABEL_BY_KIND = new Map<string, string>(KIND_OPTIONS.map((o) => [o.kind, o.label]));

/**
 * Numele raportului. `kind` vine din baza de date ca text liber, deci un tip
 * scos din registru între timp și-ar afișa codul brut în loc să dispară din listă.
 */
export function kindLabel(kind: string): string {
  return LABEL_BY_KIND.get(kind) ?? kind;
}

/**
 * Seria, spusă omenește. În fișiere „cumulat" e coloana de bilanț de la
 * începutul anului, iar „perioada" rândul intervalului raportat; aici le citește
 * lume care n-a văzut niciodată foaia de Excel, deci nu apar cuvintele din ea.
 *
 * Una și aceeași pentru previzualizarea importului și pentru tabelul „Toate
 * valorile": aceeași cifră nu are voie să fie explicată în două feluri.
 */
export const SERIES_LABEL: Record<StatSeries, string> = {
  cumulat: "de la începutul anului",
  perioada: "în perioadă",
};

export const PERIOD_TYPE_LABEL: Record<PeriodType, string> = {
  lunar: "Lunar",
  saptamanal: "Săptămânal",
};
