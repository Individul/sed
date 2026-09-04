/**
 * Instanțele de judecată, ca listă fixă.
 *
 * Text liber ar fi produs, în câteva luni, „Jud. Chișinău", „Judecătoria
 * Chișinău" și „Chisinau" ca instanțe diferite în orice raport. Sediile sunt
 * păstrate separat pentru că transferul se face către locul unde are loc
 * ședința, nu către instanța ca instituție.
 */
export const COURTS = [
  "Curtea de Apel Centru",
  "Curtea de Apel Nord",
  "Curtea de Apel Sud, sediul Central Cahul",
  "Curtea de Apel Sud, sediul Secundar Comrat",
  "Judecătoria Chișinău",
  "Judecătoria Chișinău, sediul Central (Botanica)",
  "Judecătoria Chișinău, sediul Buiucani",
  "Judecătoria Chișinău, sediul Centru",
  "Judecătoria Chișinău, sediul Rîșcani",
  "Judecătoria Chișinău, sediul Ciocana",
  "Judecătoria Criuleni, sediul Central",
  "Judecătoria Criuleni, sediul Dubăsari",
  "Judecătoria Hîncești, sediul Central",
  "Judecătoria Hîncești, sediul Ialoveni",
  "Judecătoria Hîncești, sediul Leova",
  "Judecătoria Orhei, sediul Central",
  "Judecătoria Orhei, sediul Telenești",
  "Judecătoria Orhei, sediul Rezina",
  "Judecătoria Strășeni, sediul Central",
  "Judecătoria Strășeni, sediul Călărași",
  "Judecătoria Căușeni, sediul Central",
  "Judecătoria Căușeni, sediul Anenii Noi",
  "Judecătoria Căușeni, sediul Bender (Varnița)",
  "Judecătoria Căușeni, sediul Ștefan Vodă",
  "Judecătoria Ungheni",
  "Judecătoria Bălți, sediul Central",
  "Judecătoria Bălți, sediul Fălești",
  "Judecătoria Bălți, sediul Sîngerei",
  "Judecătoria Bălți, sediul Glodeni",
  "Judecătoria Drochia, sediul Central",
  "Judecătoria Drochia, sediul Rîșcani",
  "Judecătoria Drochia, sediul Dondușeni",
  "Judecătoria Edineț, sediul Central",
  "Judecătoria Edineț, sediul Briceni",
  "Judecătoria Edineț, sediul Ocnița",
  "Judecătoria Soroca, sediul Central",
  "Judecătoria Florești",
  "Judecătoria Cahul, sediul Central",
  "Judecătoria Cahul, sediul Taraclia",
  "Judecătoria Cahul, sediul Cantemir",
  "Judecătoria Cahul, sediul Vulcănești",
  "Judecătoria Comrat, sediul Central",
  "Judecătoria Comrat, sediul Ceadîr-Lunga",
  "Judecătoria Cimișlia",
] as const;

export type Court = (typeof COURTS)[number];

export function isCourt(value: string): value is Court {
  return (COURTS as readonly string[]).includes(value);
}
