/**
 * Categoriile de infracțiuni și fracțiile din Codul penal al RM.
 *
 * Portate din `Individul/clasificare`. Numerele nu sunt alese de noi — vin din
 * art. 16, 91 și 92 CP RM — deci nu se schimbă decât dacă se schimbă legea, iar
 * atunci se schimbă aici, într-un singur loc.
 */

export type Categorie = "U" | "MPG" | "G" | "DG" | "EG";
export type CategorieVarsta = "minor" | "tanar" | "adult" | "varstnic";

export const CATEGORII: Record<Categorie, { denumire: string; pedeapsaMax: string }> = {
  U: { denumire: "Ușoară", pedeapsaMax: "≤2 ani" },
  MPG: { denumire: "Mai puțin gravă", pedeapsaMax: "≤5 ani" },
  G: { denumire: "Gravă", pedeapsaMax: "≤12 ani" },
  DG: { denumire: "Deosebit de gravă", pedeapsaMax: ">12 ani" },
  EG: { denumire: "Excepțional de gravă", pedeapsaMax: "Detențiune pe viață" },
};

/** De la cea mai ușoară la cea mai gravă. Ordinea decide „cea mai gravă". */
export const ORDINE_GRAVITATE: Categorie[] = ["U", "MPG", "G", "DG", "EG"];

export const CATEGORII_VARSTA: Record<
  CategorieVarsta,
  { denumire: string; descriere: string; beneficiazaReducere: boolean }
> = {
  minor: {
    denumire: "Minor (sub 18 ani)",
    descriere: "Nu împlinise 18 ani la momentul săvârșirii infracțiunii",
    beneficiazaReducere: true,
  },
  tanar: {
    denumire: "Tânăr (18–21 ani)",
    descriere: "Între 18 și 21 de ani la momentul săvârșirii infracțiunii",
    beneficiazaReducere: true,
  },
  adult: {
    denumire: "Adult (21–60 ani)",
    descriere: "Între 21 și 60 de ani",
    beneficiazaReducere: false,
  },
  varstnic: {
    denumire: "Vârstnic (peste 60 ani)",
    descriere: "A împlinit 60 de ani",
    beneficiazaReducere: true,
  },
};

/** Art. 91 alin. (4) — adulți. */
const FRACTIUNI_ART_91_ADULT: Record<Categorie, string> = {
  U: "1/2",
  MPG: "1/2",
  G: "2/3",
  DG: "2/3",
  EG: "2/3",
};

/** Art. 91 alin. (6) — minori, tineri 18–21, vârstnici 60+. */
const FRACTIUNI_ART_91_REDUSE: Record<Categorie, string> = {
  U: "1/3",
  MPG: "1/3",
  G: "1/2",
  DG: "2/3",
  EG: "2/3",
};

/** Art. 92 alin. (2) — aceleași pentru toți. */
const FRACTIUNI_ART_92: Record<Categorie, string> = {
  U: "1/3",
  MPG: "1/3",
  G: "1/2",
  DG: "2/3",
  EG: "2/3",
};

export const TEMEI_LEGAL_ART_92 = "art. 92 alin. (2) CP RM";

export function temeiLegalArt91(cat: Categorie, varsta: CategorieVarsta): string {
  if (CATEGORII_VARSTA[varsta].beneficiazaReducere) {
    const litera = cat === "U" || cat === "MPG" ? "a" : cat === "G" ? "b" : "c";
    return `art. 91 alin. (6) lit. ${litera}) CP RM`;
  }
  const litera = cat === "U" || cat === "MPG" ? "a" : "b";
  return `art. 91 alin. (4) lit. ${litera}) CP RM`;
}

/** Minimul obligatoriu pentru U și MPG la adulți; `null` când nu se aplică. */
export function notaArt91(cat: Categorie, varsta: CategorieVarsta): string | null {
  const reducere = CATEGORII_VARSTA[varsta].beneficiazaReducere;
  if (!reducere && (cat === "U" || cat === "MPG")) {
    return "Minim 90 de zile de închisoare obligatoriu";
  }
  return null;
}

export interface Fractiuni {
  art91: { fractiune: string; temeiLegal: string; nota: string | null };
  art92: { fractiune: string; temeiLegal: string };
}

/** Fracțiile de executat pentru art. 91 și 92, după categorie și vârstă. */
export function fractiuni(cat: Categorie, varsta: CategorieVarsta = "adult"): Fractiuni {
  const reducere = CATEGORII_VARSTA[varsta].beneficiazaReducere;
  return {
    art91: {
      fractiune: reducere ? FRACTIUNI_ART_91_REDUSE[cat] : FRACTIUNI_ART_91_ADULT[cat],
      temeiLegal: temeiLegalArt91(cat, varsta),
      nota: notaArt91(cat, varsta),
    },
    art92: { fractiune: FRACTIUNI_ART_92[cat], temeiLegal: TEMEI_LEGAL_ART_92 },
  };
}
