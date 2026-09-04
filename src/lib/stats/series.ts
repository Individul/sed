import type { StatSeries } from "./types";

/**
 * Un indicator merită afișat doar dacă a avut măcar o dată o valoare diferită
 * de zero. Cei care sunt 0 în toate perioadele (sau nu au deloc valori) sunt
 * zgomot: rapoartele conțin zeci de rânduri care nu s-au întâmplat niciodată.
 *
 * Atenție: „diferit de zero" include și negativele — suprapopularea poate fi
 * -5, iar acela e un indicator foarte relevant.
 *
 * Filtrarea se face doar la afișare. Valorile rămân salvate, ca să se poată
 * distinge oricând „raportat 0" de „nu s-a raportat".
 */
export function hasMeaningfulValue(values: (number | null | undefined)[]): boolean {
  return values.some((v) => typeof v === "number" && v !== 0);
}

/**
 * Sunt de față amândouă seriile? Doar două rapoarte din opt („comisia", „mc")
 * au și rând de perioadă; în celelalte șase fiecare valoare e „cumulat" fiindcă
 * n-are cu ce altceva să fie marcată — nu fiindcă s-ar aduna de la începutul
 * anului.
 *
 * De aceea coloana care explică seria se arată doar unde chiar e ceva de
 * deosebit. Acolo unde toate rândurile sunt la fel, a scrie „de la începutul
 * anului" lângă „Plafonul de detenție" ar fi o minciună; tăcerea nu e.
 */
export function hasBothSeries(values: { series: StatSeries }[]): boolean {
  return values.some((v) => v.series === "cumulat") && values.some((v) => v.series === "perioada");
}
