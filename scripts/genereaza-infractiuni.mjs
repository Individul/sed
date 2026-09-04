/**
 * Generează `src/lib/penal/infractiuni.json` din tabelul Codului penal.
 *
 * Sursa e fișierul Excel din proiectul `Individul/clasificare`, singurul loc
 * unde pedepsele maxime stau scrise pe alineate:
 *
 *   node scripts/genereaza-infractiuni.mjs ~/clasificare/Cod_Penal_pedeapsa_maxima_articole.xlsx
 *
 * De ce un generator și nu un JSON scris de mână: catalogul portat inițial avea
 * 664 din cele 789 de rânduri ale tabelului. Lipseau, tăcut, trei feluri de
 * intrări — articolele cu un singur alineat nenumerotat (art. 342, detențiune pe
 * viață, printre ele), cele pedepsite cu amendă (art. 217 alin. 1) și cele cu
 * muncă neremunerată. Un JSON de 789 de intrări nu se poate citi cu ochiul ca să
 * se vadă ce lipsește; un generator, da.
 *
 * Categoria nu se ia din tabel, se calculează din pedeapsă, după art. 16 CP RM.
 * Așa nu poate ajunge să se contrazică cu pedeapsa scrisă alături — iar testul
 * din `penal.test.ts` reface calculul pe tot catalogul.
 */
import ExcelJS from "exceljs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const IESIRE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/lib/penal/infractiuni.json",
);

/** Anii de închisoare din textul pedepsei; 0 dacă nu e închisoare. */
function aniInchisoare(pedeapsa) {
  if (!/închisoare/i.test(pedeapsa)) return 0;
  const ani = /(\d+)\s*(?:ani|an)\b/i.exec(pedeapsa);
  const luni = /(\d+)\s*luni/i.exec(pedeapsa);
  return (ani ? Number(ani[1]) : 0) + (luni ? Number(luni[1]) / 12 : 0);
}

/**
 * Categoria după art. 16 CP RM.
 *
 * Excepțional de gravă e numai fapta pedepsită cu detențiune pe viață — alin.
 * (6). Tabelul portat trecea acolo și 17 intrări de 17–20 de ani, ceea ce își
 * contrazicea propriul tabel de categorii.
 *
 * Faptele pedepsite doar cu amendă sau muncă neremunerată sunt ușoare: maximul
 * lor e sub pragul de 2 ani din alin. (2).
 */
function categorie(pedeapsa) {
  if (/detențiune pe viață/i.test(pedeapsa)) return "EG";
  const ani = aniInchisoare(pedeapsa);
  if (ani > 12) return "DG";
  if (ani > 5) return "G";
  if (ani > 2) return "MPG";
  return "U";
}

/**
 * Pedeapsa, adusă la o singură formă.
 *
 * În tabel stă scrisă în toate felurile: „Închisoare 15 ani" și „15 ani
 * închisoare", „amendă 400 u.c." și „400 u.c. amendă", cu majusculă sau fără.
 * Pe ecran apare lângă articol, deci trebuie să arate la fel peste tot.
 */
function pedeapsaText(pedeapsa) {
  if (/detențiune pe viață/i.test(pedeapsa)) return "detențiune pe viață";

  if (/închisoare/i.test(pedeapsa)) {
    const ani = /(\d+)\s*(?:ani|an)\b/i.exec(pedeapsa);
    const luni = /(\d+)\s*luni/i.exec(pedeapsa);
    const parti = [];
    if (ani) parti.push(`${ani[1]} ${ani[1] === "1" ? "an" : "ani"}`);
    if (luni) parti.push(`${luni[1]} luni`);
    return parti.join(" ");
  }

  const parti = [];
  const amenda = /(\d+)\s*u\.c\./i.exec(pedeapsa);
  if (amenda) parti.push(`amendă ${amenda[1]} u.c.`);
  const ore = /(\d+)\s*ore/i.exec(pedeapsa);
  if (ore) parti.push(`muncă neremunerată ${ore[1]} ore`);
  if (parti.length === 0) throw new Error(`pedeapsă necunoscută: ${pedeapsa}`);
  return parti.join(" sau ");
}

/**
 * Alineatele acoperite de un rând.
 *
 * „-" înseamnă articol fără alineate numerotate — se păstrează ca atare, e o
 * stare deosebită, nu un alineat 1. „2-6" e un interval: un singur rând pentru
 * cinci alineate cu aceeași pedeapsă, desfăcut aici ca fiecare să poată fi ales
 * din listă. Parantezele cad: „(2¹)" și „2¹" sunt același alineat.
 */
function alineate(alin) {
  const curat = alin.replace(/[()\s]/g, "");
  if (curat === "-" || curat === "") return ["-"];

  const interval = /^(\d+)-(\d+)$/.exec(curat);
  if (interval) {
    const [, de, la] = interval;
    const rez = [];
    for (let i = Number(de); i <= Number(la); i++) rez.push(String(i));
    return rez;
  }
  return [curat];
}

const sursa = process.argv[2];
if (!sursa) {
  console.error("Lipsește calea către fișierul Excel.");
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(sursa);
const foaie = wb.worksheets[0];

const infractiuni = [];
foaie.eachRow((rand, i) => {
  if (i === 1) return; // antetul
  const [, art, alin, pedeapsa] = rand.values.map((v) => String(v ?? "").trim());
  if (!art) return;
  for (const a of alineate(alin)) {
    infractiuni.push({
      art,
      alin: a,
      cat: categorie(pedeapsa),
      pedeapsa_max: pedeapsaText(pedeapsa),
    });
  }
});

// Două rânduri pentru același articol și alineat ar însemna că unul îl ascunde
// pe celălalt la căutare — și n-ai ști care.
const chei = new Set(infractiuni.map((i) => `${i.art}#${i.alin}`));
if (chei.size !== infractiuni.length) {
  throw new Error(`${infractiuni.length - chei.size} intrări repetate în tabel`);
}

await writeFile(IESIRE, `${JSON.stringify({ infractiuni }, null, 2)}\n`);
console.log(`${infractiuni.length} intrări, ${new Set(infractiuni.map((i) => i.art)).size} articole`);
