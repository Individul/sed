/**
 * Cele trei operații pe PDF: unire, ștergere de pagini, extragere de pagini.
 *
 * Portate din PDF Toolbox, care rula pe serverul Hetzner: fișierul se încărca
 * acolo, qpdf îl prelucra și se întorcea înapoi. Aici totul se petrece în
 * browser, din două motive.
 *
 * Unul e practic: funcțiile Vercel primesc cel mult 4,5 MB în corpul cererii,
 * iar un dosar scanat trece de asta din primele pagini. Vechiul nginx accepta
 * 500 MB — nu se putea muta așa cum era.
 *
 * Al doilea cântărește mai greu: fișierul nu mai pleacă de pe calculator.
 * Prin uneltele astea trec dosare cu date personale, iar o unealtă care nu
 * încarcă nimic nicăieri n-are cum să le scape.
 *
 * `pdf-lib` era deja în proiect, pentru raportul de marți.
 */
import { PDFDocument, ParseSpeeds } from "pdf-lib";

/**
 * Cum se citește și cum se scrie documentul.
 *
 * Amândouă opțiunile de mai jos închid o purtare pe care pdf-lib o are din
 * bune intenții: cedează controlul buclei de evenimente din când în când, ca
 * pagina să nu înghețe. `objectsPerTick` (implicit 50) o face la scriere,
 * `parseSpeed` (implicit `Slow`, adică 100) la citire. În Node o cedare costă
 * aproape nimic; în browser fiecare e un tur de buclă cu întârziere minimă
 * impusă, iar numărul lor crește cu documentul — deci tocmai grija de a nu
 * îngheța pagina o îngheța.
 *
 * Măsurat în browser, pe documente de probă. Numai scrierea:
 *
 *      100 pagini —      2 ms implicit,   9 ms fără cedări
 *      300 pagini —  1 311 ms implicit,   3 ms fără cedări
 *      600 pagini — 11 858 ms implicit,  48 ms fără cedări
 *
 * Iar o tăiere întreagă — citire, copiere, scriere — a unui dosar de 600 de
 * pagini: 2 511 ms cu numai scrierea reparată, 5 ms cu amândouă. La 1200 de
 * pagini, 8 ms; creșterea a redevenit liniară.
 *
 * Firul principal stă blocat cât ține lucrul, fiindcă nu mai cedează nimănui.
 * La numerele astea nu se simte — pe când 12 secunde se simt ca o defecțiune.
 */
const SCRIERE = { objectsPerTick: Infinity } as const;
const CITIRE = { ignoreEncryption: true, parseSpeed: ParseSpeeds.Fastest } as const;

/** Fișierul nu e un PDF pe care să-l putem deschide. */
export class EroarePdf extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "EroarePdf";
  }
}

/**
 * Deschide un PDF.
 *
 * `ignoreEncryption` lasă să treacă documentele cu parolă doar de tipărire —
 * multe scanate de la instanțe sunt așa, iar paginile lor se pot copia. Cele cu
 * parolă de deschidere tot cad, și atunci se spune limpede de ce.
 */
async function deschide(octeti: Uint8Array, numeFisier: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(octeti, CITIRE);
  } catch (e) {
    const motiv = e instanceof Error ? e.message : String(e);
    if (/encrypt/i.test(motiv)) {
      throw new EroarePdf(`„${numeFisier}” e protejat cu parolă și nu poate fi deschis.`);
    }
    throw new EroarePdf(`„${numeFisier}” nu se poate citi ca PDF.`);
  }
}

/** Câte pagini are documentul. Se cere înainte de a scrie specificația. */
export async function numaraPagini(octeti: Uint8Array, numeFisier: string): Promise<number> {
  const doc = await deschide(octeti, numeFisier);
  return doc.getPageCount();
}

export interface FisierPdf {
  nume: string;
  octeti: Uint8Array;
}

/**
 * Unește mai multe PDF-uri, în ordinea dată.
 *
 * Ordinea e a listei primite, nu a numelor de fișier: pe ecran omul o așază cum
 * vrea, iar o sortare ascunsă aici i-ar strica-o.
 */
export async function uneste(fisiere: FisierPdf[]): Promise<Uint8Array> {
  if (fisiere.length < 2) {
    throw new EroarePdf("Pentru unire trebuie cel puțin două fișiere.");
  }

  const rezultat = await PDFDocument.create();
  for (const f of fisiere) {
    const doc = await deschide(f.octeti, f.nume);
    const pagini = await rezultat.copyPages(doc, doc.getPageIndices());
    for (const p of pagini) rezultat.addPage(p);
  }

  if (rezultat.getPageCount() === 0) {
    throw new EroarePdf("Fișierele alese n-au nicio pagină.");
  }

  return rezultat.save(SCRIERE);
}

/**
 * Un document nou, cu paginile cerute, în ordinea cerută.
 *
 * Primește numere de la 1 — cele pe care le vede omul în cititorul de PDF-uri —
 * și le coboară la indici chiar înainte de pdf-lib. Scăderea se face aici, o
 * singură dată.
 */
export async function pastreazaPagini(
  fisier: FisierPdf,
  paginiDeLa1: number[],
): Promise<Uint8Array> {
  const doc = await deschide(fisier.octeti, fisier.nume);
  const total = doc.getPageCount();

  for (const p of paginiDeLa1) {
    if (p < 1 || p > total) {
      throw new EroarePdf(`Pagina ${p} nu există în „${fisier.nume}”.`);
    }
  }

  const rezultat = await PDFDocument.create();
  const copiate = await rezultat.copyPages(doc, paginiDeLa1.map((p) => p - 1));
  for (const p of copiate) rezultat.addPage(p);

  return rezultat.save(SCRIERE);
}

/**
 * Numele fișierului rezultat: cel dintâi, cu un adaos înaintea extensiei.
 *
 * Fără el toate cele trei operații ar scoate „document.pdf" peste
 * „document.pdf" din care a pornit, iar în folderul Descărcări n-ai mai ști
 * care e care.
 */
export function numeRezultat(numeOriginal: string, adaos: string): string {
  const curat = numeOriginal.replace(/[\\/]/g, "").trim() || "document.pdf";
  const fara = curat.replace(/\.pdf$/i, "");
  return `${fara}-${adaos}.pdf`;
}
