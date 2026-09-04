// Normalizează pentru căutare: litere mici + fără diacritice (Crîlov ≈ Crilov).
export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
