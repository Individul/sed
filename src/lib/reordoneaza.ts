/**
 * Mută un element al unei liste pe alt loc.
 *
 * Scoasă din componenta care trage fișierele cu mâna, fiindcă e chiar felul de
 * socoteală care greșește cu o poziție fără să se vadă: după ce elementul e
 * scos, indicii de după el s-au mutat deja cu unu, iar o inserare la indexul
 * vechi îl așază lângă locul cerut, nu pe el. Aici se poate verifica; într-o
 * componentă, doar cu ochiul.
 *
 * Nu e o schimbare între vecini. Cine trage al cincilea fișier peste primul se
 * așteaptă să-l vadă primul, cu celelalte împinse în jos — nu pe primul ajuns
 * al cincilea.
 */
export function reordoneaza<T>(lista: readonly T[], de: number, la: number): T[] {
  const copie = [...lista];
  if (de === la) return copie;
  if (de < 0 || la < 0 || de >= copie.length || la >= copie.length) return copie;
  const [luat] = copie.splice(de, 1);
  copie.splice(la, 0, luat);
  return copie;
}
