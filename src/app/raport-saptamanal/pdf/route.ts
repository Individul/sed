/**
 * Raportul săptămânal, ca PDF descărcabil.
 *
 * Hârtia care se predă marți dimineața. Ecranul se poate reîncărca; PDF-ul, o
 * dată tipărit sau trimis, rămâne — deci tot ce e discutabil aici s-a hotărât
 * în favoarea documentului, nu a codului.
 *
 * **Fontul.** Cele paisprezece fonturi standard din PDF nu conțin ș, ț și ă:
 * codificarea lor se oprește la Latin-1, iar literele astea sunt în Latin
 * Extended. Fără font încorporat, „Ședințe" iese „Sedinte" sau cu pătrate —
 * un raport care trece orice test automat și cade la prima privire a
 * conducerii. De aceea se încarcă Noto Sans (SIL OFL 1.1), cu fontkit.
 *
 * Cifrele nu se adună aici. `weeklyFigures` e singurul loc unde se socotesc,
 * pentru ecran și pentru hârtie deopotrivă — vezi comentariul din
 * `lib/weekly-report.ts` despre „8 restanțe într-un loc, 1 în altul".
 *
 * Sesiunea o cere middleware-ul, care acoperă toate căile în afară de `/login`,
 * `/auth` și `/api/backup`. Ruta nu-și mai verifică o dată utilizatorul, dar
 * depinde de el: interogările merg pe sesiunea lui, prin RLS. Dacă ruta ar
 * ajunge vreodată publică, n-ar da o eroare — ar da un PDF plin de zerouri,
 * ceea ce e mult mai rău. Nu o adăuga la excepțiile din
 * `lib/supabase/middleware.ts`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { missingWorkdays } from "@/lib/hearings";
import { FUS, parseISODate, rangeLabelRo, toISODate, todayInChisinau } from "@/lib/periods";
import { getCurrentProfile, getHearings, getReleases, getTransfers } from "@/lib/queries";
import { readWeek, reportWeek, weeklyFigures } from "@/lib/weekly-report";

// `fs` și fontkit cer Node, nu runtime-ul Edge. Scris explicit, ca o schimbare
// de configurație să nu mute ruta pe Edge fără să observe nimeni.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ fontul */

/**
 * Noto Sans, adus în repo din
 * https://github.com/notofonts/notofonts.github.io (fonts/NotoSans/unhinted/ttf),
 * varianta „unhinted": hinting-ul e pentru rasterizarea pe ecran la corpuri
 * mici, iar fontul intră întreg în fiecare document (vezi `embedFont` mai jos),
 * deci cele 190 KB pe fișier s-ar plăti la fiecare descărcare. Licența — SIL
 * Open Font License 1.1 — stă alături, în `src/fonts/OFL.txt`.
 *
 * Calea pleacă din `process.cwd()`, iar fișierele ajung lângă ea în funcția de
 * pe Vercel prin `outputFileTracingIncludes` — vezi `next.config.mjs`, unde e
 * scris de ce nu se întâmplă asta de la sine.
 */
const FONT_DIR = path.join(process.cwd(), "src", "fonts");

/**
 * Octeții fonturilor, citiți o dată per instanță.
 *
 * 860 KB de pe disc la fiecare descărcare ar fi risipă: fișierele nu se schimbă
 * decât la un deploy, care oricum pornește o instanță nouă. Se ține minte doar
 * materialul brut — `embedFont` se cheamă separat pentru fiecare document,
 * fiindcă fontul încorporat aparține documentului în care a intrat.
 */
let fontBytes: { regular: Buffer; bold: Buffer } | null = null;

async function loadFontBytes(): Promise<{ regular: Buffer; bold: Buffer }> {
  if (!fontBytes) {
    const [regular, bold] = await Promise.all([
      readFile(path.join(FONT_DIR, "NotoSans-Regular.ttf")),
      readFile(path.join(FONT_DIR, "NotoSans-Bold.ttf")),
    ]);
    fontBytes = { regular, bold };
  }
  return fontBytes;
}

/* ------------------------------------------------------------------ desenul */

// A4 în puncte, marginea la 2 cm — formatul în care se tipărește aici orice act.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const CENTER_X = PAGE_W / 2;

const NEGRU = rgb(0, 0, 0);
const GRI = rgb(0.42, 0.42, 0.42);
const LINIE = rgb(0.78, 0.78, 0.78);

interface Text {
  font: PDFFont;
  size: number;
  color?: ReturnType<typeof rgb>;
}

function drawCentered(page: PDFPage, text: string, x: number, y: number, s: Text): void {
  page.drawText(text, {
    x: x - s.font.widthOfTextAtSize(text, s.size) / 2,
    y,
    size: s.size,
    font: s.font,
    color: s.color ?? NEGRU,
  });
}

function drawRight(page: PDFPage, text: string, right: number, y: number, s: Text): void {
  page.drawText(text, {
    x: right - s.font.widthOfTextAtSize(text, s.size),
    y,
    size: s.size,
    font: s.font,
    color: s.color ?? NEGRU,
  });
}

/**
 * Rupe un text în linii care încap în lățimea dată.
 *
 * Fără asta, o notă mai lungă ar ieși din pagină — pdf-lib scrie tot ce i se
 * dă, pe o singură linie, inclusiv în afara colii. Ruperea se face pe cuvinte,
 * măsurând cu fontul real: lățimea unui caracter în Noto Sans nu se poate
 * ghici din numărul de litere.
 */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const linii: string[] = [];
  let linie = "";
  for (const cuvant of text.split(" ")) {
    const incercare = linie ? `${linie} ${cuvant}` : cuvant;
    if (font.widthOfTextAtSize(incercare, size) <= maxWidth) {
      linie = incercare;
    } else {
      if (linie) linii.push(linie);
      linie = cuvant;
    }
  }
  if (linie) linii.push(linie);
  return linii;
}

/* -------------------------------------------------------------------- ruta */

export async function GET(request: NextRequest): Promise<NextResponse> {
  // O singură citire a ceasului, ca în pagină: la 23:59:59 săptămâna și zilele
  // lipsă s-ar putea calcula de-o parte și de alta a miezului nopții.
  const now = new Date();
  // Ziua se ia pe calendarul Chișinăului, ca în pagină: ceasul serverului e UTC
  // și până la ora 3 dimineața la noi ar da încă ziua de ieri, adică hârtia
  // săptămânii trecute sub un subsol datat cu ziua de azi.
  const today = todayInChisinau(now);
  // Aceeași funcție ca pagina, nu o copie a ei: altfel butonul „Descarcă PDF"
  // ar putea întoarce cu totul altă săptămână decât cea de pe ecran.
  const week = readWeek(request.nextUrl.searchParams.get("saptamana"), reportWeek(today));
  const from = toISODate(week.from);
  const to = toISODate(week.to);

  const [profile, hearings, transfers, releases, fonturi] = await Promise.all([
    getCurrentProfile(),
    getHearings(from, to),
    getTransfers(),
    getReleases(from, to),
    loadFontBytes(),
  ]);

  // Toate patru cifrele ies de aici, exact ca pe ecran. Ruta nu adună nimic.
  const figures = weeklyFigures(week, { transfers, hearings, releases: releases.rows });
  const missing = missingWorkdays(week, hearings, today);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  /**
   * Fontul intră întreg. **Nu pune `{ subset: true }` aici.**
   *
   * Sună a risipă — 480 KB de font pentru o pagină — și de-asta merită scris de
   * ce nu e. Subsetarea din `@pdf-lib/fontkit` (1.1.1, o furculiță veche a lui
   * fontkit) strică Noto Sans: glifele compuse, adică exact literele făcute din
   * literă + semn — ă, ș, ț, î — rămân fără componentele lor, iar cititorul de
   * PDF le sare. Încercat, nu presupus: cu subsetare, „Date statistice" se
   * tipărea „Da s a s", iar mupdf scotea „invalid composite glyph".
   *
   * Ce face capcana serioasă e că nu se vede din cod: textul extras din PDF
   * rămâne corect (ToUnicode e scris bine), deci orice verificare automată pe
   * conținut trece. Doar desenul e găurit. Se prinde numai deschizând fișierul.
   *
   * DejaVu Sans trece de subsetare, dar n-am ales-o: subsetul se face din
   * glifele chiar folosite, iar aici intră un nume de om din baza de date. Ar
   * însemna ca un raport să iasă bine săptămâni la rând și să se rupă la primul
   * nume cu o literă pe care n-am încercat-o — pe hârtia deja semnată.
   */
  const regular = await pdf.embedFont(fonturi.regular);
  const bold = await pdf.embedFont(fonturi.bold);

  pdf.setTitle(`Date statistice ${rangeLabelRo(week)}`);
  pdf.setAuthor(profile?.full_name ?? "Penitenciarul nr. 6");
  pdf.setCreator("Registrul Secției evidența deținuți");

  const page = pdf.addPage([PAGE_W, PAGE_H]);

  /* antet */
  drawCentered(page, "SECȚIA EVIDENȚA DEȚINUȚI", CENTER_X, PAGE_H - 72, {
    font: regular,
    size: 8.5,
    color: GRI,
  });
  drawCentered(page, "Date statistice", CENTER_X, PAGE_H - 100, { font: bold, size: 20 });
  drawCentered(page, rangeLabelRo(week), CENTER_X, PAGE_H - 120, {
    font: regular,
    size: 11,
    color: GRI,
  });

  /* cele patru cifre */
  const CUTIE_SUS = PAGE_H - 148;
  const CUTIE_H = 108;
  const CUTIE_JOS = CUTIE_SUS - CUTIE_H;
  const COL_W = CONTENT_W / 4;

  page.drawRectangle({
    x: MARGIN,
    y: CUTIE_JOS,
    width: CONTENT_W,
    height: CUTIE_H,
    borderColor: LINIE,
    borderWidth: 0.75,
  });

  const coloane: { label: string; value: string; hint?: string }[] = [
    { label: "Plecați", value: String(figures.plecati) },
    { label: "Sosiți", value: String(figures.sositi) },
    {
      label: "Teleconferințe",
      value: String(figures.teleconferinte),
      // Totalul e petrecute + amânate; nu trebuie să ascundă din ce se face.
      hint: `din care amânate: ${figures.amanate}`,
    },
    {
      label: "Eliberați",
      /**
       * „—", nu 0, când registrul n-a putut fi citit.
       *
       * Un zero aici arată exact ca o săptămână în care n-a ieșit nimeni, iar
       * celelalte trei cifre fiind corecte, nimeni n-ar avea motiv să se
       * îndoiască tocmai de a patra. Ecranul refuză deja să afirme zeroul;
       * hârtia, care se arhivează, cu atât mai mult.
       */
      value: releases.available ? String(figures.eliberati) : "—",
    },
  ];

  coloane.forEach((col, i) => {
    const centru = MARGIN + (i + 0.5) * COL_W;
    if (i > 0) {
      page.drawLine({
        start: { x: MARGIN + i * COL_W, y: CUTIE_JOS + 16 },
        end: { x: MARGIN + i * COL_W, y: CUTIE_SUS - 16 },
        thickness: 0.5,
        color: LINIE,
      });
    }
    drawCentered(page, col.value, centru, CUTIE_JOS + 54, {
      font: bold,
      size: 30,
      color: col.value === "—" ? GRI : NEGRU,
    });
    drawCentered(page, col.label, centru, CUTIE_JOS + 30, { font: regular, size: 10, color: GRI });
    if (col.hint) {
      drawCentered(page, col.hint, centru, CUTIE_JOS + 16, { font: regular, size: 8, color: GRI });
    }
  });

  /*
   * Golurile se tipăresc odată cu cifrele.
   *
   * Zilele lipsă se scriu și pe hârtie: una care tace despre golurile ei lasă
   * impresia că săptămâna e acoperită integral, iar ea ajunge la dosar, unde nu
   * mai are cine s-o întrebe ce n-a apucat să numere.
   *
   * Se scrie golul, nu și părerea despre el. Explicația că „cifra e mai mică
   * decât realitatea" a rămas doar pe ecran, unde e un îndemn la completare:
   * într-un raport care pleacă la ANP, ea nu lămurește pe nimeni — doar taie
   * creanga cifrei de deasupra. Cine citește vede zilele lipsă și judecă singur.
   */
  const note: string[] = [];
  if (missing.length > 0) {
    const zile = missing.map((iso) => format(parseISODate(iso), "d MMM", { locale: ro })).join(", ");
    note.push(
      `${missing.length} ${missing.length === 1 ? "zi lucrătoare" : "zile lucrătoare"} fără ` +
        `ședințe introduse: ${zile}.`,
    );
  }
  if (!releases.available) {
    note.push(
      "Registrul eliberărilor nu poate fi citit, cel mai probabil fiindcă migrarea " +
        "0026_releases.sql n-a fost aplicată pe baza de date. Cifra e scrisă „—”, nu 0: " +
        "zeroul ar spune că săptămâna a fost verificată și n-a ieșit nimeni. Celelalte " +
        "trei cifre sunt întregi.",
    );
  }

  let y = CUTIE_JOS - 30;
  for (const nota of note) {
    for (const linie of wrap(nota, regular, 9, CONTENT_W - 14)) {
      page.drawText(linie, { x: MARGIN + 14, y, size: 9, font: regular, color: GRI });
      y -= 12;
    }
    y -= 8;
  }

  /* subsol */
  page.drawLine({
    start: { x: MARGIN, y: 78 },
    end: { x: PAGE_W - MARGIN, y: 78 },
    thickness: 0.5,
    color: LINIE,
  });
  page.drawText(`Întocmit: ${profile?.full_name ?? "—"}`, {
    x: MARGIN,
    y: 62,
    size: 9,
    font: regular,
    color: GRI,
  });
  // Ora Chișinăului, spusă explicit: serverul merge pe UTC, iar un act oficial
  // cu ceasul dat cu două-trei ore înapoi la fiecare descărcare ridică exact
  // întrebările pe care nu le vrei la dosar.
  drawRight(
    page,
    new Intl.DateTimeFormat("ro-RO", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: FUS,
    }).format(now),
    PAGE_W - MARGIN,
    62,
    { font: regular, size: 9, color: GRI },
  );

  /**
   * `pdf.save()` dă un `Uint8Array` peste un `ArrayBufferLike` — care poate fi
   * și `SharedArrayBuffer` — iar `BodyInit` nu-l primește: de la TypeScript 5.7
   * array-urile tipizate poartă în tip buffer-ul de sub ele. Copia într-un
   * `ArrayBuffer` curat e mai onestă decât un `as unknown as BodyInit`, care ar
   * ascunde întrebarea în loc s-o rezolve; costă o singură copie de ~500 KB pe
   * descărcare, adică nimic față de desenarea documentului.
   */
  const bytes = new Uint8Array(await pdf.save()).buffer;

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="raport-${from}.pdf"`,
      // Raportul se recitește din bază la fiecare descărcare: o eliberare
      // introdusă acum două minute trebuie să fie în fișierul de acum.
      "Cache-Control": "no-store",
    },
  });
}
