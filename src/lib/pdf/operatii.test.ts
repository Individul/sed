import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { EroarePdf, numaraPagini, numeRezultat, pastreazaPagini, uneste } from "./operatii";

/**
 * Un PDF de probă în care fiecare pagină se poate recunoaște după lățime.
 *
 * Textul dintr-o pagină nu se poate citi înapoi cu pdf-lib, deci ar rămâne doar
 * numărătoarea paginilor — care trece și când ordinea e greșită. Lățimea, în
 * schimb, se citește: pagina „lată de 101" e recognoscibilă oriunde ajunge.
 */
async function pdfDeProba(latimi: number[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const l of latimi) doc.addPage([l, 200]);
  return doc.save();
}

/** Lățimile paginilor, adică urmele lăsate de `pdfDeProba`. */
async function latimi(octeti: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(octeti);
  return doc.getPages().map((p) => Math.round(p.getWidth()));
}

describe("numărarea paginilor", () => {
  it("spune câte are", async () => {
    expect(await numaraPagini(await pdfDeProba([100, 101, 102]), "x.pdf")).toBe(3);
  });

  it("un fișier care nu e PDF se oprește cu numele lui în mesaj", async () => {
    const gunoi = new TextEncoder().encode("nu sunt un pdf");
    await expect(numaraPagini(gunoi, "raport.docx")).rejects.toThrow(/raport\.docx/);
    await expect(numaraPagini(gunoi, "raport.docx")).rejects.toThrow(EroarePdf);
  });
});

describe("unirea", () => {
  it("pune paginile cap la cap, în ordinea fișierelor", async () => {
    const rezultat = await uneste([
      { nume: "a.pdf", octeti: await pdfDeProba([100, 101]) },
      { nume: "b.pdf", octeti: await pdfDeProba([200]) },
      { nume: "c.pdf", octeti: await pdfDeProba([300, 301]) },
    ]);
    expect(await latimi(rezultat)).toEqual([100, 101, 200, 300, 301]);
  });

  it("ordinea e a listei, nu a numelor", async () => {
    // Pe ecran fișierele se pot muta în sus și în jos; o sortare ascunsă aici
    // ar desface tăcut tocmai munca aceea.
    const rezultat = await uneste([
      { nume: "z.pdf", octeti: await pdfDeProba([300]) },
      { nume: "a.pdf", octeti: await pdfDeProba([100]) },
    ]);
    expect(await latimi(rezultat)).toEqual([300, 100]);
  });

  it("un singur fișier nu e o unire", async () => {
    await expect(
      uneste([{ nume: "a.pdf", octeti: await pdfDeProba([100]) }]),
    ).rejects.toThrow(/cel puțin două/);
  });

  it("un fișier stricat din mijloc oprește totul, cu numele lui", async () => {
    // Mai bine nimic decât un document unit din care lipsește tăcut o bucată.
    await expect(
      uneste([
        { nume: "bun.pdf", octeti: await pdfDeProba([100]) },
        { nume: "stricat.pdf", octeti: new TextEncoder().encode("###") },
      ]),
    ).rejects.toThrow(/stricat\.pdf/);
  });
});

describe("păstrarea paginilor", () => {
  it("extrage exact paginile cerute", async () => {
    const sursa = { nume: "d.pdf", octeti: await pdfDeProba([100, 101, 102, 103, 104]) };
    expect(await latimi(await pastreazaPagini(sursa, [2, 4]))).toEqual([101, 103]);
  });

  it("păstrează ordinea cerută, chiar întoarsă", async () => {
    const sursa = { nume: "d.pdf", octeti: await pdfDeProba([100, 101, 102]) };
    expect(await latimi(await pastreazaPagini(sursa, [3, 1]))).toEqual([102, 100]);
  });

  it("ștergerea e tot o păstrare — a celorlalte", async () => {
    const sursa = { nume: "d.pdf", octeti: await pdfDeProba([100, 101, 102, 103]) };
    expect(await latimi(await pastreazaPagini(sursa, [1, 3, 4]))).toEqual([100, 102, 103]);
  });

  it("o pagină inexistentă se oprește înainte de a scrie ceva", async () => {
    const sursa = { nume: "d.pdf", octeti: await pdfDeProba([100, 101]) };
    await expect(pastreazaPagini(sursa, [5])).rejects.toThrow(/Pagina 5/);
    await expect(pastreazaPagini(sursa, [0])).rejects.toThrow(/Pagina 0/);
  });

  it("un document mare iese întreg", async () => {
    // Scrierea se face fără cedări către bucla de evenimente (vezi `SCRIERE` din
    // `operatii.ts`), iar asta e tocmai felul de schimbare care poate tăia tăcut
    // sfârșitul fișierului. Aici se numără paginile și se citesc urmele lor.
    const latimiSursa = Array.from({ length: 400 }, (_, i) => 100 + (i % 50));
    const sursa = { nume: "mare.pdf", octeti: await pdfDeProba(latimiSursa) };
    const rezultat = await pastreazaPagini(sursa, [1, 200, 400]);
    expect(await latimi(rezultat)).toEqual([
      latimiSursa[0],
      latimiSursa[199],
      latimiSursa[399],
    ]);
  });

  it("documentul rezultat se poate redeschide", async () => {
    // Un PDF salvat greșit se vede abia când îl deschide cineva. Aici se
    // deschide chiar în test.
    const sursa = { nume: "d.pdf", octeti: await pdfDeProba([100, 101, 102]) };
    const rezultat = await pastreazaPagini(sursa, [2]);
    expect(await numaraPagini(rezultat, "rezultat.pdf")).toBe(1);
  });
});

describe("numele fișierului rezultat", () => {
  it("adaugă înaintea extensiei", () => {
    expect(numeRezultat("dosar.pdf", "unit")).toBe("dosar-unit.pdf");
  });

  it("nu se încurcă de majuscule în extensie", () => {
    expect(numeRezultat("Dosar.PDF", "extras")).toBe("Dosar-extras.pdf");
  });

  it("un nume fără extensie primește una", () => {
    expect(numeRezultat("dosar", "unit")).toBe("dosar-unit.pdf");
  });

  it("căile din nume cad", () => {
    // Numele vine din fișierul ales de om și ajunge într-o descărcare; o bară
    // în el n-are ce căuta.
    expect(numeRezultat("../etc/dosar.pdf", "unit")).toBe("..etcdosar-unit.pdf");
  });

  it("un nume gol tot dă un fișier deschizabil", () => {
    expect(numeRezultat("", "unit")).toBe("document-unit.pdf");
  });
});
