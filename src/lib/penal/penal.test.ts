import { describe, expect, it } from "vitest";
import { fractiuni, type Categorie } from "./categorii";
import { ceaMaiGrava as ceaMaiGravaCat } from "./clasificare";
import {
  INFRACTIUNI,
  alineatePentru,
  articole,
  ceaMaiGrava,
  cheieAlineat,
  cheieNumar,
  gasesteInfractiune,
  numeInfractiune,
  variantePentru,
} from "./clasificare";
import {
  adaugaTermen,
  calculeazaTermen,
  fractieDinTermen,
  scadeArest,
  scadeTermen,
  sfarsitTermen,
  zileIntre,
  termenText,
} from "./termene";

const zi = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("catalogul de infracțiuni", () => {
  it("cuprinde tot tabelul Codului penal", () => {
    // 789 de rânduri în tabel, dintre care unul acoperă alineatele 2–6 ale art.
    // 185², desfăcute aici. Dacă la o regenerare se pierd intrări, aici se vede.
    expect(INFRACTIUNI.length).toBe(793);
    expect(articole().length).toBe(327);
  });

  it("categoria fiecărei intrări iese din pedeapsa ei", () => {
    // Catalogul e generat, dar generatorul se poate schimba; asta reface
    // socoteala art. 16 pe toate cele 793 de intrări. O categorie care nu se mai
    // potrivește cu pedeapsa scrisă alături e chiar felul de greșeală care nu se
    // vede: un rând plauzibil, cu altă fracție.
    const asteptata = (pedeapsa: string): Categorie => {
      if (/detențiune pe viață/.test(pedeapsa)) return "EG";
      if (!/an|luni/.test(pedeapsa)) return "U"; // amendă, muncă neremunerată
      const ani = /(\d+)\s*(?:ani|an)\b/.exec(pedeapsa);
      const luni = /(\d+)\s*luni/.exec(pedeapsa);
      const total = (ani ? Number(ani[1]) : 0) + (luni ? Number(luni[1]) / 12 : 0);
      if (total > 12) return "DG";
      if (total > 5) return "G";
      if (total > 2) return "MPG";
      return "U";
    };
    const gresite = INFRACTIUNI.filter((i) => i.cat !== asteptata(i.pedeapsa_max));
    expect(gresite).toEqual([]);
  });

  it("excepțional de gravă înseamnă numai detențiune pe viață", () => {
    // Art. 16 alin. (6). Catalogul portat trecea acolo și 17 intrări de 17–20 de
    // ani, contrazicându-și propriul tabel de categorii.
    const eg = INFRACTIUNI.filter((i) => i.cat === "EG");
    expect(eg.length).toBeGreaterThan(0);
    expect(eg.every((i) => i.pedeapsa_max === "detențiune pe viață")).toBe(true);
  });

  it("ține și faptele fără închisoare, și articolele fără alineate", () => {
    // Trei feluri de intrări pe care catalogul portat le pierdea în tăcere.
    expect(gasesteInfractiune("217", "1")?.pedeapsa_max).toBe("amendă 400 u.c.");
    expect(gasesteInfractiune("217/5", "1")?.pedeapsa_max).toBe("muncă neremunerată 240 ore");
    expect(gasesteInfractiune("342", "-")?.cat).toBe("EG");
    expect(gasesteInfractiune("338", "-")?.cat).toBe("DG");
  });

  it("fiecare intrare are o categorie cunoscută", () => {
    const valide: Categorie[] = ["U", "MPG", "G", "DG", "EG"];
    const straine = INFRACTIUNI.filter((i) => !valide.includes(i.cat));
    expect(straine).toEqual([]);
  });
});

describe("găsirea infracțiunii", () => {
  it("potrivire directă pe articol și alineat", () => {
    expect(gasesteInfractiune("145", "1")?.cat).toBe("DG");
    expect(gasesteInfractiune("145", "2")?.cat).toBe("EG");
  });

  it("alineatele cu exponent se găsesc", () => {
    // „1¹" nu e „11": exponentul face parte din alineat.
    expect(gasesteInfractiune("149", "1¹")).not.toBeNull();
  });

  it("articolele cu indice se găsesc scrise cu bară", () => {
    // Catalogul le ține cu exponent — „217¹" — dar exponentul nu se poate tasta.
    expect(gasesteInfractiune("217/1", "4")?.art).toBe("217¹");
    expect(gasesteInfractiune("217¹", "4")?.art).toBe("217¹");
  });

  it("articolul cu indice NU e același cu articolul de bază", () => {
    // Chiar cazul care strică rezultatul fără să pară: aceleași cifre, alt
    // alineat, altă categorie — deci altă fracție și altă dată de liberare.
    expect(gasesteInfractiune("217", "4")?.cat).toBe("G");
    expect(gasesteInfractiune("217/1", "4")?.cat).toBe("DG");
  });

  it("indicele din două cifre nu se rupe", () => {
    // „245¹⁰" e articolul 245/10, nu 245/1 urmat de un zero.
    expect(gasesteInfractiune("245/10", "(1)")?.art).toBe("245¹⁰");
    expect(gasesteInfractiune("245/1", "(1)")?.art).not.toBe("245¹⁰");
  });

  it("un articol inexistent nu întoarce nimic", () => {
    expect(gasesteInfractiune("9999", "1")).toBeNull();
  });

  it("alineatele unui articol se pot lista", () => {
    expect(alineatePentru("145")).toContain("1");
    expect(alineatePentru("145")).toContain("2");
  });

  it("alineatele articolului de bază nu le cuprind pe ale celui cu indice", () => {
    // Amestecate, se putea alege un alineat care nu există la articolul din
    // listă.
    expect([...new Set(alineatePentru("217"))].sort()).toEqual(["1", "2", "3", "4"]);
    expect([...new Set(alineatePentru("217/2"))]).toEqual(["-"]);
  });

  it("articolul fără alineate se scrie fără „alin.”", () => {
    const fara = gasesteInfractiune("342", "-")!;
    expect(numeInfractiune(fara)).toBe("Art. 342");
    expect(numeInfractiune(gasesteInfractiune("217/1", "4")!)).toBe("Art. 217¹ alin. 4");
  });
});

describe("scrierea numerelor de articol", () => {
  it("toate felurile de a scrie același articol duc în același loc", () => {
    for (const scris of ["217/1", "217¹", "217-1", "217 1", "art. 217/1", "217^1"]) {
      expect(cheieNumar(scris)).toBe("217/1");
    }
  });

  it("articolul fără indice rămâne fără indice", () => {
    expect(cheieNumar("217")).toBe("217");
    expect(cheieNumar("art. 145")).toBe("145");
  });

  it("alineatele cu paranteze și exponenți se aduc la aceeași formă", () => {
    expect(cheieNumar("(2¹)")).toBe("2/1");
    expect(cheieNumar("2¹")).toBe("2/1");
    expect(cheieNumar("(1)")).toBe("1");
  });

  it("ce nu conține nicio cifră nu e număr de articol", () => {
    expect(cheieNumar("")).toBe("");
    expect(cheieNumar("art.")).toBe("");
    expect(gasesteInfractiune("", "1")).toBeNull();
  });

  it("lipsa alineatului nu se confundă cu un câmp gol", () => {
    // Altfel un articol fără alineate s-ar potrivi cu orice căutare neîncepută.
    expect(cheieAlineat("-")).toBe("-");
    expect(cheieAlineat("")).toBe("");
    expect(gasesteInfractiune("342", "")).toBeNull();
  });

  it("normalizarea nu suprapune două intrări deosebite din catalog", () => {
    // Dacă o regenerare ar aduce două intrări care se pliază pe aceeași cheie,
    // aici se vede — înainte ca una s-o ascundă tăcut pe alta.
    const chei = INFRACTIUNI.map((i) => `${cheieNumar(i.art)}#${cheieAlineat(i.alin)}`);
    expect(new Set(chei).size).toBe(INFRACTIUNI.length);
  });
});

describe("variantele unui articol", () => {
  it("le adună pe toate cele care împart numărul", () => {
    expect(variantePentru("217")).toEqual([
      "217",
      "217¹",
      "217²",
      "217³",
      "217⁴",
      "217⁵",
      "217⁶",
    ]);
  });

  it("se ajunge la aceeași listă pornind de la oricare dintre ele", () => {
    expect(variantePentru("217/4")).toEqual(variantePentru("217"));
  });

  it("un articol fără variante se întoarce singur", () => {
    expect(variantePentru("145")).toEqual(["145"]);
  });

  it("articolele se listează în ordinea din Cod, nu cum s-au nimerit", () => {
    const toate = articole();
    const i = (a: string) => toate.indexOf(a);
    expect(i("165")).toBeLessThan(i("165¹"));
    expect(i("165¹")).toBeLessThan(i("166"));
    expect(i("245⁹")).toBeLessThan(i("245¹⁰"));
  });
});

describe("cea mai gravă categorie", () => {
  const inf = (art: string, alin: string, cat: Categorie) => ({ art, alin, cat, pedeapsa_max: "" });

  it("dintre mai multe, hotărăște cea mai gravă", () => {
    const r = ceaMaiGrava([inf("1", "1", "U"), inf("145", "2", "EG"), inf("2", "1", "G")]);
    expect(r.categorie).toBe("EG");
    expect(r.articolDeterminant).toBe("Art. 145 alin. 2");
  });

  it("fără infracțiuni, nu hotărăște nimic", () => {
    expect(ceaMaiGrava([]).categorie).toBeNull();
  });
});

describe("fracțiile art. 91 și 92", () => {
  it("adultul nu beneficiază de reducere", () => {
    const f = fractiuni("G", "adult");
    expect(f.art91.fractiune).toBe("2/3");
    expect(f.art91.temeiLegal).toBe("art. 91 alin. (4) lit. b) CP RM");
  });

  it("minorul beneficiază", () => {
    expect(fractiuni("G", "minor").art91.fractiune).toBe("1/2");
  });

  it("nota de 90 de zile apare doar la adult, U și MPG", () => {
    expect(fractiuni("U", "adult").art91.nota).toContain("90");
    expect(fractiuni("U", "minor").art91.nota).toBeNull();
    expect(fractiuni("G", "adult").art91.nota).toBeNull();
  });

  it("art. 92 nu ține seama de vârstă", () => {
    expect(fractiuni("G", "adult").art92.fractiune).toBe(fractiuni("G", "minor").art92.fractiune);
  });
});

describe("sfârșitul termenului", () => {
  it("un an expiră în ziua precedentă", () => {
    // Regula RM: un an de la 10 martie 2026 se încheie pe 9 martie 2027.
    expect(zi(sfarsitTermen(new Date(2026, 2, 10), { ani: 1, luni: 0, zile: 0 })))
      .toBe("2027-03-09");
  });

  it("la termenul numai în luni NU se scade ziua", () => {
    // Confirmat de utilizator: ziua precedentă e regulă doar pentru ani.
    expect(zi(sfarsitTermen(new Date(2026, 0, 10), { ani: 0, luni: 6, zile: 0 })))
      .toBe("2026-07-10");
  });

  it("la termenul micst, cu zile, NU se scade ziua", () => {
    // Cazul dat de utilizator: 10.03.2026 + 2 ani, 6 luni și 10 zile.
    expect(zi(sfarsitTermen(new Date(2026, 2, 10), { ani: 2, luni: 6, zile: 10 })))
      .toBe("2028-09-20");
  });

  it("la termenul numai în zile NU se scade ziua", () => {
    // Confirmat: 30 de zile de la 10 martie se încheie pe 9 aprilie.
    expect(zi(sfarsitTermen(new Date(2026, 2, 10), { ani: 0, luni: 0, zile: 30 })))
      .toBe("2026-04-09");
  });

  it("la ani plus luni NU se scade: nu e termen numai în ani", () => {
    expect(zi(sfarsitTermen(new Date(2026, 2, 10), { ani: 2, luni: 6, zile: 0 })))
      .toBe("2028-09-10");
  });

  it("adăugarea fără scăderea zilei dă chiar ziua corespunzătoare", () => {
    expect(zi(adaugaTermen(new Date(2026, 2, 10), { ani: 1, luni: 0, zile: 0 })))
      .toBe("2027-03-10");
  });

  it("o lună de la 31 ianuarie se încheie pe 28 februarie", () => {
    // Cazul dat de utilizator. „31 februarie" nu există, deci termenul expiră
    // în ultima zi a lunii — iar atunci nu se mai scade ziua, fiindcă ultima zi
    // E chiar expirarea. Aplicația de origine dădea 2 martie, rostogolind luna.
    expect(zi(sfarsitTermen(new Date(2026, 0, 31), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2026-02-28");
  });

  it("nici de la 30 ianuarie nu se trece în martie", () => {
    expect(zi(sfarsitTermen(new Date(2026, 0, 30), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2026-02-28");
  });

  it("o lună de la 1 martie se încheie pe 1 aprilie", () => {
    // Confirmat de utilizator. Ziua nu se scade la termenele în luni, deci
    // rezultatul e data corespunzătoare din luna următoare, nu ziua dinainte.
    expect(zi(sfarsitTermen(new Date(2026, 2, 1), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2026-04-01");
  });

  it("un an de la 31 ianuarie nu retează: ianuarie are 31 de zile", () => {
    expect(zi(sfarsitTermen(new Date(2026, 0, 31), { ani: 1, luni: 0, zile: 0 })))
      .toBe("2027-01-30");
  });

  it("29 februarie într-un an bisect, plus un an", () => {
    // 29 februarie 2029 nu există, deci se retează la 28 și nu se scade ziua.
    expect(zi(sfarsitTermen(new Date(2028, 1, 29), { ani: 1, luni: 0, zile: 0 })))
      .toBe("2029-02-28");
  });

  it("aprilie n-are 31 de zile", () => {
    expect(zi(sfarsitTermen(new Date(2026, 2, 31), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2026-04-30");
  });

  it("fracțiile se retează la fel, dar nu scad ziua", () => {
    // `adaugaTermen` fără scădere: o lună de la 31 ianuarie cade pe 28 februarie.
    expect(zi(adaugaTermen(new Date(2026, 0, 31), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2026-02-28");
  });

});

describe("fracția din termen", () => {
  it("jumătate dintr-un an e șase luni, nu 182 de zile", () => {
    expect(fractieDinTermen({ ani: 1, luni: 0, zile: 0 }, "1/2"))
      .toEqual({ ani: 0, luni: 6, zile: 0 });
  });

  it("două treimi din trei ani", () => {
    expect(fractieDinTermen({ ani: 3, luni: 0, zile: 0 }, "2/3"))
      .toEqual({ ani: 2, luni: 0, zile: 0 });
  });

  it("restul din luni curge în zile", () => {
    // 1 lună la 1/2 = 15 zile.
    expect(fractieDinTermen({ ani: 0, luni: 1, zile: 0 }, "1/2"))
      .toEqual({ ani: 0, luni: 0, zile: 15 });
  });

  it("zilele peste 30 se strâng înapoi în luni", () => {
    expect(fractieDinTermen({ ani: 0, luni: 5, zile: 0 }, "1/2"))
      .toEqual({ ani: 0, luni: 2, zile: 15 });
  });

  it("o fracție fără înțeles nu produce un termen", () => {
    expect(fractieDinTermen({ ani: 1, luni: 0, zile: 0 }, "-"))
      .toEqual({ ani: 0, luni: 0, zile: 0 });
  });
});

describe("zilele de arest preventiv", () => {
  it("exemplul din aplicația de origine: 29.01.2015 – 29.04.2015 = 90 zile", () => {
    // Regula [start, end): ziua de început se include, cea de sfârșit nu.
    expect(zileIntre(new Date(2015, 0, 29), new Date(2015, 3, 29))).toBe(90);
  });

  it("o singură zi de arest", () => {
    expect(zileIntre(new Date(2026, 5, 1), new Date(2026, 5, 2))).toBe(1);
  });

  it("aceeași zi înseamnă zero, nu una", () => {
    // Numărate inclusiv la ambele capete ar da 1 — o zi în plus la arest e o zi
    // în minus la pedeapsă.
    expect(zileIntre(new Date(2026, 5, 1), new Date(2026, 5, 1))).toBe(0);
  });

  it("trecerea la ora de vară nu scurtează diferența", () => {
    // În 2026 ora de vară începe pe 29 martie în Europa.
    expect(zileIntre(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
  });

  it("peste un an bisect", () => {
    expect(zileIntre(new Date(2028, 1, 1), new Date(2028, 2, 1))).toBe(29);
  });
});

describe("arestul preventiv", () => {
  it("se scade din data calculată", () => {
    expect(zi(scadeArest(new Date(2027, 2, 9), 30))).toBe("2027-02-07");
  });

  it("zero zile nu mișcă nimic", () => {
    expect(zi(scadeArest(new Date(2027, 2, 9), 0))).toBe("2027-03-09");
  });
});

describe("formula documentată", () => {
  it("data_început + termen − arest − 1 zi", () => {
    // Așa e scrisă regula în aplicația de origine. Ordinea scăderilor nu
    // schimbă rezultatul, dar testul o pironește: dacă cineva mută scăderea
    // arestului înaintea adunării termenului, regula zilei precedente s-ar
    // aplica altui număr și data ar aluneca.
    const start = new Date(2026, 2, 1);
    const termen = { ani: 3, luni: 0, zile: 0 }; // numai ani: aici se scade ziua
    const arest = zileIntre(new Date(2026, 0, 1), new Date(2026, 2, 1)); // 59 zile

    const r = calculeazaTermen(start, termen, "2/3", arest);

    const asteptat = new Date(2029, 2, 1); // 1 martie 2029
    asteptat.setDate(asteptat.getDate() - arest - 1);
    expect(zi(r.sfarsitCuArest)).toBe(zi(asteptat));
  });
});

describe("calculul întreg", () => {
  it("sfârșit, fracție și eligibilitate deodată", () => {
    // 3 ani de la 1 martie 2026, categoria gravă, adult: fracția e 2/3.
    const r = calculeazaTermen(new Date(2026, 2, 1), { ani: 3, luni: 0, zile: 0 }, "2/3", 0);
    expect(zi(r.sfarsit)).toBe("2029-02-28");
    expect(r.deExecutat).toEqual({ ani: 2, luni: 0, zile: 0 });
    expect(zi(r.eligibil)).toBe("2028-03-01");
  });

  it("arestul preventiv mută ambele date înapoi", () => {
    const r = calculeazaTermen(new Date(2026, 2, 1), { ani: 3, luni: 0, zile: 0 }, "2/3", 60);
    expect(zi(r.sfarsitCuArest)).toBe("2028-12-30");
    expect(zi(r.eligibil)).toBe("2028-01-01");
  });
});

describe("termenul scris în cuvinte", () => {
  it("toate trei unitățile", () => {
    expect(termenText({ ani: 2, luni: 6, zile: 10 })).toBe("2 ani, 6 luni și 10 zile");
  });

  it("singularul se scrie corect", () => {
    expect(termenText({ ani: 1, luni: 1, zile: 1 })).toBe("1 an, 1 lună și 1 zi");
  });

  it("termenul gol", () => {
    expect(termenText({ ani: 0, luni: 0, zile: 0 })).toBe("0 zile");
  });
});

describe("reducerea termenului", () => {
  // Cazul: sfârșitul e stabilit, iar o încheiere reduce pedeapsa.
  it("zece zile dintr-un sfârșit de termen", () => {
    expect(zi(scadeTermen(new Date(2027, 0, 25), { ani: 0, luni: 0, zile: 10 })))
      .toBe("2027-01-15");
  });

  it("un an, șapte luni și două zile", () => {
    // Se scade pe rând: anul, apoi lunile, apoi zilele.
    expect(zi(scadeTermen(new Date(2027, 0, 25), { ani: 1, luni: 7, zile: 2 })))
      .toBe("2025-06-23");
  });

  it("retezarea lucrează și înapoi", () => {
    // „31 februarie" nu există în niciun sens, nici scăzând.
    expect(zi(scadeTermen(new Date(2027, 2, 31), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2027-02-28");
    expect(zi(scadeTermen(new Date(2027, 4, 31), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2027-04-30");
  });

  it("29 februarie minus un an cade pe 28", () => {
    expect(zi(scadeTermen(new Date(2028, 1, 29), { ani: 1, luni: 0, zile: 0 })))
      .toBe("2027-02-28");
  });

  it("trece peste hotarul anului", () => {
    expect(zi(scadeTermen(new Date(2027, 0, 5), { ani: 0, luni: 0, zile: 10 })))
      .toBe("2026-12-26");
  });

  it("NU se scade ziua precedentă a doua oară", () => {
    // Regula privește termenele care expiră. Sfârșitul e deja calculat; o
    // reducere doar îl dă înapoi. Aplicată și aici, ziua ar fi scăzută de două
    // ori, iar omul ar ieși cu o zi mai devreme decât spune încheierea.
    const sfarsit = new Date(2027, 0, 25);
    expect(zi(scadeTermen(sfarsit, { ani: 1, luni: 0, zile: 0 }))).toBe("2026-01-25");
  });

  it("reducere zero nu mișcă data", () => {
    expect(zi(scadeTermen(new Date(2027, 0, 25), { ani: 0, luni: 0, zile: 0 })))
      .toBe("2027-01-25");
  });
});

/**
 * Drumul întreg, cum îl parcurge pagina: articolele din sentință dau categoria,
 * categoria dă fracția, iar fracția — cu pedeapsa de sus — dă data.
 *
 * Până acum bucățile erau verificate una câte una, dar nimic nu ținea legătura
 * dintre ele. Ea e chiar ce vede omul pe ecran: o dată, nu o fracție.
 */
describe("de la articol la data art. 91 / 92", () => {
  const infractiunile = (...perechi: [string, string][]) =>
    perechi.map(([art, alin]) => gasesteInfractiune(art, alin)!);

  it("omor, adult: 2/3 dintr-o pedeapsă de 15 ani", () => {
    const grava = ceaMaiGravaCat(infractiunile(["145", "1"]));
    expect(grava.categorie).toBe("DG");

    const f = fractiuni(grava.categorie!, "adult");
    expect(f.art91.fractiune).toBe("2/3");

    // 15 ani, din 1 martie 2026. Două treimi fac 10 ani: 1 martie 2036.
    const r = calculeazaTermen(
      new Date(2026, 2, 1),
      { ani: 15, luni: 0, zile: 0 },
      f.art91.fractiune,
    );
    expect(termenText(r.deExecutat)).toBe("10 ani");
    expect(zi(r.eligibil)).toBe("2036-03-01");
    // Sfârșitul e altă dată decât eligibilitatea, și se scade ziua: termen numai
    // în ani.
    expect(zi(r.sfarsit)).toBe("2041-02-28");
  });

  it("aceeași faptă, minor: fracția scade, deci scade și data", () => {
    const grava = ceaMaiGravaCat(infractiunile(["186", "1"]));
    const adult = fractiuni(grava.categorie!, "adult").art91.fractiune;
    const minor = fractiuni(grava.categorie!, "minor").art91.fractiune;
    expect([adult, minor]).toEqual(["1/2", "1/3"]);

    const pedeapsa = { ani: 3, luni: 0, zile: 0 };
    const start = new Date(2026, 0, 10);
    expect(zi(calculeazaTermen(start, pedeapsa, adult).eligibil)).toBe("2027-07-10");
    expect(zi(calculeazaTermen(start, pedeapsa, minor).eligibil)).toBe("2027-01-10");
  });

  it("arestul preventiv scade și din data eligibilității, nu doar din sfârșit", () => {
    // Altfel omul ar aștepta zilele pe care le-a stat deja închis.
    const f = fractiuni("G", "adult");
    const r = calculeazaTermen(
      new Date(2026, 2, 1),
      { ani: 6, luni: 0, zile: 0 },
      f.art91.fractiune,
      100,
    );
    const faraArest = calculeazaTermen(
      new Date(2026, 2, 1),
      { ani: 6, luni: 0, zile: 0 },
      f.art91.fractiune,
      0,
    );
    expect(zileIntre(r.eligibil, faraArest.eligibil)).toBe(100);
  });

  it("cea mai gravă hotărăște fracția, nu ultima introdusă", () => {
    // Cazul pentru care lista primește mai multe articole.
    const grava = ceaMaiGravaCat(infractiunile(["145", "1"], ["186", "1"]));
    expect(grava.categorie).toBe("DG");
    expect(fractiuni(grava.categorie!, "adult").art91.fractiune).toBe("2/3");
  });
});
