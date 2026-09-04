import { describe, expect, it } from "vitest";
import { citestePagini, EroarePagini, paginiDePastrat } from "./pagini";

describe("citirea specificației de pagini", () => {
  it("pagini răzlețe", () => {
    expect(citestePagini("1,3,5", 10)).toEqual([1, 3, 5]);
  });

  it("interval", () => {
    expect(citestePagini("2-5", 10)).toEqual([2, 3, 4, 5]);
  });

  it("amestecate", () => {
    expect(citestePagini("1,3-5,7", 10)).toEqual([1, 3, 4, 5, 7]);
  });

  it("spațiile nu contează", () => {
    expect(citestePagini("  1 , 3 - 5 ", 10)).toEqual([1, 3, 4, 5]);
  });

  it("le pune în ordine și nu le repetă", () => {
    // Omul scrie cum îi vine, nu sortat; iar „3-5,4" numește de două ori pagina 4.
    expect(citestePagini("5,1,3-5,4", 10)).toEqual([1, 3, 4, 5]);
  });

  it("un interval de o singură pagină e chiar pagina aceea", () => {
    expect(citestePagini("4-4", 10)).toEqual([4]);
  });

  it("virgulele goale se trec cu vederea", () => {
    // „1,,3" și „1,3," ies de sub degete des; n-au ce strica.
    expect(citestePagini("1,,3", 10)).toEqual([1, 3]);
    expect(citestePagini("1,3,", 10)).toEqual([1, 3]);
  });

  it("gol înseamnă greșeală, nu «toate»", () => {
    expect(() => citestePagini("", 10)).toThrow(EroarePagini);
    expect(() => citestePagini("   ", 10)).toThrow(EroarePagini);
    expect(() => citestePagini(",,", 10)).toThrow(EroarePagini);
  });

  it("pagina de peste sfârșit spune câte are documentul", () => {
    expect(() => citestePagini("11", 10)).toThrow(/10 pagini/);
    expect(() => citestePagini("8-12", 10)).toThrow(/10 pagini/);
  });

  it("«pagină» la singular când documentul are una", () => {
    expect(() => citestePagini("2", 1)).toThrow(/1 pagină/);
  });

  it("zero și numerele negative", () => {
    // Paginile se numără de la 1: un „0" ar aluneca tăcut la ultima pagină dacă
    // s-ar scădea 1 fără să se verifice.
    expect(() => citestePagini("0", 10)).toThrow(EroarePagini);
    expect(() => citestePagini("-3", 10)).toThrow(EroarePagini);
  });

  it("interval întors pe dos", () => {
    expect(() => citestePagini("5-3", 10)).toThrow(/începe după/);
  });

  it("ce nu e număr", () => {
    expect(() => citestePagini("abc", 10)).toThrow(EroarePagini);
    expect(() => citestePagini("1-a", 10)).toThrow(EroarePagini);
    expect(() => citestePagini("1-2-3", 10)).toThrow(EroarePagini);
    expect(() => citestePagini("2-", 10)).toThrow(EroarePagini);
  });

  it("zecimalele nu se rotunjesc pe tăcute", () => {
    // `Number("3.5")` dă 3,5, iar cine scrie cu virgulă zecimală ar primi altă
    // pagină decât a cerut, fără să afle.
    expect(() => citestePagini("3.5", 10)).toThrow(EroarePagini);
  });
});

describe("ce rămâne în document", () => {
  it("la extragere rămân chiar paginile numite", () => {
    expect(paginiDePastrat("2,4", 6, "extrage")).toEqual([2, 4]);
  });

  it("la ștergere rămân toate celelalte", () => {
    expect(paginiDePastrat("2,4", 6, "sterge")).toEqual([1, 3, 5, 6]);
  });

  it("ștergerea tuturor paginilor se oprește", () => {
    expect(() => paginiDePastrat("1-6", 6, "sterge")).toThrow(/ar rămâne gol/);
  });

  it("cele două operații sunt exact pe dos una față de alta", () => {
    const total = 9;
    const spec = "1,4-6,9";
    const extrase = paginiDePastrat(spec, total, "extrage");
    const ramase = paginiDePastrat(spec, total, "sterge");
    expect([...extrase, ...ramase].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(extrase.filter((p) => ramase.includes(p))).toEqual([]);
  });
});
