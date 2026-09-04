/**
 * Citirea unei specificații de pagini: „1,3,5-7".
 *
 * Portat din `pagespec.py` al aplicației PDF Toolbox, care rula pe serverul
 * Hetzner. Regulile sunt aceleași — se schimbă doar limba mesajelor, fiindcă
 * acum le citește cine lucrează în secție, nu un jurnal de server.
 *
 * Toate numerele sunt de la 1, ca în cititorul de PDF-uri: omul scrie ce vede
 * scris pe pagină, nu ce indice are în tablou. Trecerea la 0 se face o singură
 * dată, în `operatii.ts`, chiar înainte de pdf-lib.
 */

/** Greșeală în ce a scris omul, nu în program. Se arată, nu se înghite. */
export class EroarePagini extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "EroarePagini";
  }
}

/**
 * Paginile numite de specificație, în ordine crescătoare și fără repetări.
 *
 * `total` nu e o formalitate: fără el „1-500" ar trece de aici și ar cădea abia
 * în pdf-lib, cu un mesaj despre indici. Aici se poate spune care pagină
 * lipsește și câte are documentul.
 */
export function citestePagini(spec: string, total: number): number[] {
  if (!spec || !spec.trim()) {
    throw new EroarePagini("Scrie ce pagini să fie luate.");
  }

  const pagini = new Set<number>();

  for (const bucataBruta of spec.split(",")) {
    const bucata = bucataBruta.trim();
    if (!bucata) continue;

    if (bucata.includes("-")) {
      const capete = bucata.split("-");
      if (capete.length !== 2) {
        throw new EroarePagini(`Interval scris greșit: „${bucata}”.`);
      }

      const de = capete[0].trim();
      const la = capete[1].trim();
      if (!de || !la) {
        throw new EroarePagini(`Interval scris greșit: „${bucata}”.`);
      }

      const inceput = numar(de, bucata);
      const sfarsit = numar(la, bucata);

      if (inceput <= 0 || sfarsit <= 0) {
        throw new EroarePagini(`Paginile se numără de la 1: „${bucata}”.`);
      }
      if (inceput > sfarsit) {
        throw new EroarePagini(
          `Intervalul începe după ce se termină: ${inceput}-${sfarsit}.`,
        );
      }

      for (let p = inceput; p <= sfarsit; p++) {
        verificaFinal(p, total);
        pagini.add(p);
      }
    } else {
      const p = numar(bucata, bucata);
      if (p <= 0) {
        throw new EroarePagini(`Paginile se numără de la 1: „${bucata}”.`);
      }
      verificaFinal(p, total);
      pagini.add(p);
    }
  }

  if (pagini.size === 0) {
    throw new EroarePagini("Nicio pagină în ce ai scris.");
  }

  return [...pagini].sort((a, b) => a - b);
}

/**
 * Un număr întreg, altfel o greșeală explicată.
 *
 * `Number("3.5")` dă 3,5 și `Number("")` dă 0 — amândouă ar trece mai departe
 * tăcut, iar „3,5" e chiar ce scrie omul din obișnuință cu virgula zecimală.
 */
function numar(text: string, bucata: string): number {
  if (!/^\d+$/.test(text)) {
    throw new EroarePagini(`Nu e un număr de pagină: „${bucata}”.`);
  }
  return Number(text);
}

function verificaFinal(pagina: number, total: number): void {
  if (pagina > total) {
    throw new EroarePagini(
      `Documentul are ${total} ${total === 1 ? "pagină" : "pagini"}, deci pagina ${pagina} nu există.`,
    );
  }
}

export type ModPagini = "extrage" | "sterge";

/**
 * Paginile care rămân în documentul rezultat.
 *
 * La „extrage" sunt chiar cele numite; la „șterge", toate celelalte. Un singur
 * loc hotărăște asta, ca cele două operații să nu poată ajunge să numere
 * altfel.
 */
export function paginiDePastrat(spec: string, total: number, mod: ModPagini): number[] {
  const numite = citestePagini(spec, total);

  if (mod === "extrage") return numite;

  const numiteSet = new Set(numite);
  const raman: number[] = [];
  for (let p = 1; p <= total; p++) {
    if (!numiteSet.has(p)) raman.push(p);
  }

  // Un PDF fără nicio pagină nu se poate deschide. Mai bine oprit aici, unde se
  // poate spune de ce, decât salvat și trimis mai departe gol.
  if (raman.length === 0) {
    throw new EroarePagini("Nu poți șterge toate paginile — documentul ar rămâne gol.");
  }

  return raman;
}
