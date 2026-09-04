import date from "./infractiuni.json";
import { ORDINE_GRAVITATE, type Categorie } from "./categorii";

/**
 * Clasificarea unei infracțiuni după articol și alineat.
 *
 * Portată din `Individul/clasificare`. Catalogul are 664 de intrări acoperind
 * 250 de articole, dintre care 90 cu indice — scrise cu exponenți Unicode:
 * „217¹", „245¹⁰". Exponenții nu se pot tasta, iar omul scrie „217/1", deci
 * potrivirea se face pe o formă canonică, nu pe șirul din catalog.
 *
 * Nu e o comoditate: art. 217 alin. 4 e infracțiune gravă, iar art. 217/1
 * alin. 4 e deosebit de gravă. Cine caută al doilea și nu-l găsește îl adaugă
 * pe primul — și iese cu altă fracție și altă dată de liberare.
 *
 * Unele articole n-au alineate numerotate — art. 342, de pildă. Alineatul lor e
 * `FARA_ALINEAT`, o stare deosebită, nu un alineat 1: „art. 342 alin. 1" nu
 * există în Cod și n-are ce fi scris nici pe ecran.
 */

export interface Infractiune {
  art: string;
  alin: string;
  cat: Categorie;
  pedeapsa_max: string;
}

export const INFRACTIUNI = (date as { infractiuni: Infractiune[] }).infractiuni;

const EXPONENTI = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/**
 * Forma canonică a unui număr de articol sau de alineat: „număr" sau
 * „număr/indice".
 *
 * Aceeași intrare din Cod se scrie în cinci feluri — „217¹" în catalog, „217/1"
 * la tastatură, „217-1" în unele acte, „art. 217 1" copiat dintr-o sentință —
 * și toate trebuie să ducă în același loc. Deci: cifrele de la început fac
 * numărul, orice exponent sau semn de despărțire trece în indice, restul
 * (literele din „art.", punctuația, spațiile) se ignoră.
 *
 * Merge și pentru alineate, care în catalog apar și cu paranteze — „(2¹)" și
 * „2¹" sunt același alineat. Verificat pe tot catalogul: normalizarea nu
 * suprapune două intrări deosebite.
 */
export function cheieNumar(input: string): string {
  let numar = "";
  let indice = "";
  let inIndice = false;

  for (const c of input.trim()) {
    const exponent = EXPONENTI.indexOf(c);
    if (exponent >= 0) {
      inIndice = true;
      indice += exponent;
      continue;
    }
    if (c >= "0" && c <= "9") {
      if (inIndice) indice += c;
      else numar += c;
      continue;
    }
    // Semnul de despărțire contează doar după ce a început numărul: altfel
    // spațiul din „art. 217" ar deschide indicele înainte de prima cifră.
    if (numar && "/-^ ".includes(c)) inIndice = true;
  }

  if (!numar) return "";
  return indice ? `${numar}/${indice}` : numar;
}

/** Articolele fără alineate numerotate poartă asta în loc de număr. */
export const FARA_ALINEAT = "-";

/**
 * Cheia unui alineat. Ca a articolului, plus starea „articol fără alineate":
 * ea trebuie să se potrivească doar cu ea însăși, nu cu un câmp gol.
 */
export function cheieAlineat(input: string): string {
  const curat = input.trim();
  if (curat === "-" || curat === "–" || curat === "—") return FARA_ALINEAT;
  return cheieNumar(curat);
}

/** Cum se scrie infracțiunea pe ecran, cu sau fără alineat. */
export function numeInfractiune(inf: Infractiune): string {
  return inf.alin === FARA_ALINEAT ? `Art. ${inf.art}` : `Art. ${inf.art} alin. ${inf.alin}`;
}

/** Caută infracțiunea, oricum ar fi scris omul articolul și alineatul. */
export function gasesteInfractiune(
  articol: string,
  alineat: string,
  catalog: Infractiune[] = INFRACTIUNI,
): Infractiune | null {
  const a = cheieNumar(articol);
  const al = cheieAlineat(alineat);
  if (!a || !al) return null;
  return catalog.find((i) => cheieNumar(i.art) === a && cheieAlineat(i.alin) === al) ?? null;
}

/**
 * Articolele din catalog care împart același număr cu cel scris: 217 și
 * 217¹…217⁶.
 *
 * Ele sunt infracțiuni deosebite, cu categorii deosebite, dar omul care scrie
 * „217" n-are de unde ști că mai există cinci. De aceea se arată sub câmp, de
 * unde se aleg dintr-un click — singura cale de a scrie exponentul.
 */
export function variantePentru(articol: string, catalog: Infractiune[] = INFRACTIUNI): string[] {
  const numar = cheieNumar(articol).split("/")[0];
  if (!numar) return [];
  const gasite = [...new Set(catalog.filter((i) => cheieNumar(i.art).split("/")[0] === numar).map((i) => i.art))];
  return gasite.sort(comparaArticole);
}

export interface CeaMaiGrava {
  categorie: Categorie | null;
  articolDeterminant: string;
  infractiune: Infractiune | null;
}

/**
 * Cea mai gravă dintre infracțiunile adăugate — ea dă categoria pe care se
 * calculează fracțiile. Se întoarce și care anume a hotărât, fiindcă altfel
 * rezultatul ar fi o literă fără explicație.
 */
export function ceaMaiGrava(adaugate: Infractiune[]): CeaMaiGrava {
  if (adaugate.length === 0) {
    return { categorie: null, articolDeterminant: "", infractiune: null };
  }
  let maxIndex = -1;
  let determinanta: Infractiune | null = null;
  for (const inf of adaugate) {
    const i = ORDINE_GRAVITATE.indexOf(inf.cat);
    if (i > maxIndex) {
      maxIndex = i;
      determinanta = inf;
    }
  }
  return {
    categorie: ORDINE_GRAVITATE[maxIndex],
    articolDeterminant: determinanta ? numeInfractiune(determinanta) : "",
    infractiune: determinanta,
  };
}

/**
 * Alineatele existente pentru un articol, pentru lista din formular.
 *
 * Numai ale articolului cerut. Până acum le aduna și pe ale articolelor cu
 * același număr — 217 arăta și alineatele lui 217¹ — iar alineatul ales de
 * acolo nimerea apoi pe altă infracțiune decât cea din listă.
 */
export function alineatePentru(articol: string, catalog: Infractiune[] = INFRACTIUNI): string[] {
  const a = cheieNumar(articol);
  if (!a) return [];
  return catalog.filter((i) => cheieNumar(i.art) === a).map((i) => i.alin);
}

/**
 * Ordinea din Cod: după număr, apoi după indice. Se compară forma canonică —
 * `Number("217¹")` e NaN, iar o sortare pe NaN lasă lista în ordinea în care s-a
 * nimerit să fie citită.
 */
function comparaArticole(a: string, b: string): number {
  const [na, ia] = cheieNumar(a).split("/");
  const [nb, ib] = cheieNumar(b).split("/");
  return Number(na) - Number(nb) || Number(ia ?? 0) - Number(ib ?? 0);
}

/** Articolele distincte din catalog, în ordinea din Cod. */
export function articole(catalog: Infractiune[] = INFRACTIUNI): string[] {
  return [...new Set(catalog.map((i) => i.art))].sort(comparaArticole);
}
