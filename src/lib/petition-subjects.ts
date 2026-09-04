/**
 * Obiectele cel mai des întâlnite, oferite ca butoane de completare rapidă sub
 * câmpul „Obiect". Nu sunt etichete și nu se stochează separat: butoanele doar
 * compun textul câmpului, care rămâne liber editabil.
 */
export const SUBJECT_PRESETS = [
  "Executare pedepsei",
  "Art. 91",
  "Art. 92",
  "Art. 107",
  "Copii acte",
  "Copii din dosarul personal",
  "Transfer",
  "Audiență",
] as const;

/** Separatorul cu care se scriu obiectele alese. La citire se acceptă și „;” fără spațiu. */
const SEPARATOR = "; ";

/** Bucățile distincte ale unui obiect compus, fără spații în plus și fără goluri. */
export function splitSubject(subject: string): string[] {
  return subject
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Presetarea e deja aleasă? Fără majuscule, ca să tolereze și scrierea de mână. */
export function hasSubjectPreset(subject: string, preset: string): boolean {
  const needle = preset.trim().toLowerCase();
  return splitSubject(subject).some((part) => part.toLowerCase() === needle);
}

/**
 * Adaugă presetarea dacă lipsește, o scoate dacă e deja acolo. Bucățile scrise
 * de mână rămân neatinse, în ordinea în care au fost tastate.
 */
export function toggleSubjectPreset(subject: string, preset: string): string {
  const parts = splitSubject(subject);
  const needle = preset.trim().toLowerCase();
  const at = parts.findIndex((part) => part.toLowerCase() === needle);
  if (at > -1) parts.splice(at, 1);
  else parts.push(preset);
  return parts.join(SEPARATOR);
}
