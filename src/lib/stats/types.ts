export type StatKind =
  | "r_lunar" | "liberati" | "amnistia_2016" | "amnistia_2021"
  | "gratiere" | "comisia" | "mc" | "sedinte";

export type StatSeries = "cumulat" | "perioada";

export interface StatItem {
  indicator: string;
  series: StatSeries;
  value: number | null;
}

/** Grilă de celule: rânduri × coloane, index 0 = rândul/coloana 1. */
export type Grid = (string | number | boolean | Date | null)[][];

export interface StatParser {
  kind: StatKind;
  label: string;
  /** Cât de sigur e că grila e de acest tip (0..1); cel mai mare câștigă. */
  detect(grid: Grid): number;
  parse(grid: Grid): StatItem[];
}
