/**
 * Din harta de etichete, lista pentru un meniu derulant.
 *
 * Există fiindcă perechea „un `Record<Tip, string>` tipizat, plus un array
 * scris separat de mână cu aceleași etichete" s-a dovedit o capcană: harta e
 * păzită de compilator, lista nu. Când s-a adăugat starea „în așteptare" la
 * sarcini, harta a primit-o și lista n-a primit-o — puteai seta starea, dar nu
 * filtra după ea, și nimic nu s-a plâns.
 *
 * Derivată din hartă, lista nu poate rămâne în urmă.
 *
 * `Object.entries` păstrează ordinea în care au fost scrise cheile, deci
 * ordinea din hartă e ordinea din meniu — scrie-le în ordinea în care vrei să
 * fie citite, nu alfabetic.
 */
export function optionsFrom<K extends string>(
  labels: Record<K, string>,
): { value: K; label: string }[] {
  return (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }));
}
