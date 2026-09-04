/**
 * A modificat salvarea ceva cu adevărat?
 *
 * Fără verificarea asta, un „Salvează" apăsat din reflex — de pildă după ce s-a
 * atașat scanarea unei petiții proaspăt înregistrate — trimitea „a fost
 * modificată" deși niciun câmp nu se schimbase.
 *
 * Se compară doar cheile din `next`, superficial: valorile sunt scalari sau
 * null. `undefined` și `null` se consideră egale, fiindcă baza întoarce null
 * acolo unde formularul lasă câmpul gol.
 */
export function hasChanges(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): boolean {
  return Object.keys(next).some((key) => (prev[key] ?? null) !== (next[key] ?? null));
}
