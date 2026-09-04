import type { StatItem, StatKind, StatSeries } from "./types";

/**
 * Ce grafic i se potrivește fiecărui raport.
 *
 * Prima versiune a paginii de statistici era o unealtă generică: alegeai tipul
 * de raport, bifai indicatori dintr-o listă lungă și primeai o linie. Nu se
 * înțelegea nimic. Aici scrie, pentru fiecare din cele opt rapoarte, ce plăci
 * și ce grafice i se potrivesc conținutului: o linie pentru populația
 * penitenciară în timp, un cerc pentru motivele liberării, bare pentru
 * comparații.
 *
 * Modulul e pur: fără React, fără citiri de fișiere, fără bibliotecă de
 * grafice. Componentele care desenează vin separat și citesc de aici.
 *
 * Numele indicatorilor de mai jos sunt cele reale, compuse de parsere din
 * celulele de antet ale dărilor de seamă. Sunt lungi și scrise inconsecvent
 * (sedilă vs. virgulă, „incideța" în loc de „incidența"), de aceea referințele
 * se potrivesc normalizat și pe prefix, iar fiecare are o etichetă scurtă
 * pentru legendă și axă.
 */

/** O trimitere la un indicator din datele unei perioade. */
export interface ValueRef {
  /** Numele indicatorului, întreg sau doar începutul lui. */
  indicator: string;
  /**
   * Seria cerută. Se pune doar la rapoartele care au și rând de perioadă
   * (comisia, mecanismul compensatoriu): acolo același nume are două valori
   * diferite, iar fără serie s-ar lua prima nimerită.
   */
  series?: StatSeries;
  /** Eticheta din legendă/axă. Numele brute sunt de zeci de caractere. */
  label: string;
  /**
   * Numai la `kind: "grouped"`: grupul de pe axă căruia îi aparține valoarea.
   * Trebuie să fie unul din `ChartSpec.groups`; `label` devine seria (culoarea).
   */
  group?: string;
}

export type TileTone = "default" | "good" | "bad";

/**
 * Valori care nu se citesc așa cum sunt scrise în fișier și au nevoie de o
 * regulă de afișare. Deocamdată una singură.
 */
export type TileDerive = "suprapopulare";

export interface TileSpec extends ValueRef {
  tone?: TileTone;
  /** Când e pus, eticheta și tonul plăcii ies din `deriveTile`, nu de aici. */
  derive?: TileDerive;
}

/** Formele unui grafic categorial. `hbars` = bare orizontale, pentru etichete lungi. */
export type CategoricalForm = "donut" | "bars" | "hbars";

export interface ChartSpec {
  title: string;
  kind: "line" | "categorical" | "grouped";
  series: ValueRef[];
  /** Numai la linie: baza punctată, gri (plafonul de detenție). */
  reference?: ValueRef;
  /** Numai la bare grupate: numele grupurilor de pe axă. */
  groups?: string[];
  /**
   * Numai la categorial: fixează forma. Lipsește când forma se alege după
   * câți indicatori au rămas cu valori — vezi `pickCategoricalForm`.
   */
  form?: CategoricalForm;
  /**
   * Numai la categorial: graficul arată părți dintr-un întreg (cercul
   * liberărilor, barele amnistiei). Într-un asemenea grafic nu are voie să
   * intre niciun rând „Total …": totalul ar apărea ca felie lângă propriile
   * lui părți și graficul ar minți. Totalurile stau pe plăci, deasupra.
   */
  composition?: boolean;
}

export interface ReportView {
  title: string;
  tiles: TileSpec[];
  charts: ChartSpec[];
}

/**
 * Semnele diacritice pe care le desprinde `normalize("NFD")` din literă:
 * căciula lui ă/â/î, virgula lui ș/ț și sedila lui ş/ţ. Intervalul e scris cu
 * numere (U+0300–U+036F) pentru că altfel în cod ar sta caractere invizibile.
 */
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g",
);

/**
 * Forma normalizată a unui nume de indicator: fără diacritice, cu litere mici
 * și cu spațiile colapsate. Fișierele reale amestecă sedila cu virgula
 * („Amnistiaţi" / „Amnistiați") și lasă spații duble prin celule.
 */
export function normalizeIndicator(s: string): string {
  return s
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Valoarea indicatorului cerut, sau `null` dacă nu există.
 *
 * Potrivirea se face pe numele normalizat, întâi exact și abia apoi pe prefix.
 * Prefixul e comod — „Art. 473/2" prinde „Art. 473/2 alin. (3) CPP (compensat,
 * condiții de detenție)" —, dar singur ar greși: în liberări condamnații
 * amnistiați se cheamă „Amnistiaţi (Art. 107 CP)", iar preveniții amnistiați
 * doar „Amnistiați", și pe prefix ar câștiga mereu primul.
 *
 * `null` înseamnă „nu s-a raportat", nu „zero": un 0 raportat se întoarce ca 0.
 */
export function findValue(values: StatItem[], ref: ValueRef | string): number | null {
  const name = normalizeIndicator(typeof ref === "string" ? ref : ref.indicator);
  if (name === "") return null;

  const wantedSeries = typeof ref === "string" ? undefined : ref.series;
  const pool =
    wantedSeries === undefined
      ? values
      : values.filter((value) => value.series === wantedSeries);

  const hit =
    pool.find((value) => normalizeIndicator(value.indicator) === name) ??
    pool.find((value) => normalizeIndicator(value.indicator).startsWith(name));

  return hit?.value ?? null;
}

/**
 * Cercul e lizibil doar cu puține felii; de la șapte în sus se citesc bare.
 * Se cheamă cu numărul de indicatori care chiar au valori în perioada afișată,
 * nu cu numărul de referințe din configurație: rapoartele au zeci de rânduri
 * care n-au avut niciodată nimic în ele.
 */
export function pickCategoricalForm(count: number): "donut" | "bars" {
  return count <= 6 ? "donut" : "bars";
}

export interface DerivedTile {
  label: string;
  value: number;
  tone: TileTone;
}

/**
 * Regula de afișare a valorilor care nu se citesc literal.
 *
 * „Suprapopularea" din raportul lunar e deținuți − plafon, deci **negativul
 * înseamnă locuri libere**: −5 se arată ca „Locuri libere 5", verde. Nu e o
 * eroare de citire și nu trebuie „reparat" nicăieri; pozitivul e suprapopulare
 * reală și se arată roșu. Zero e plin la fix, tot pe partea bună.
 */
export function deriveTile(derive: TileDerive, value: number): DerivedTile {
  switch (derive) {
    case "suprapopulare":
      return value > 0
        ? { label: "Suprapopulare", value, tone: "bad" }
        : { label: "Locuri libere", value: Math.abs(value), tone: "good" };
  }
}

const R_LUNAR: ReportView = {
  title: "Populație penitenciară",
  tiles: [
    { indicator: "Persoane deținute", label: "Deținuți" },
    { indicator: "Plafonul de detenție", label: "Plafon" },
    { indicator: "Suprapopularea", label: "Suprapopulare", derive: "suprapopulare" },
  ],
  charts: [
    {
      title: "Deținuți față de plafonul de detenție",
      kind: "line",
      series: [{ indicator: "Persoane deținute", label: "Deținuți" }],
      reference: { indicator: "Plafonul de detenție", label: "Plafon" },
    },
  ],
};

/**
 * Motivele liberării, fără niciun rând „Total …": în fișier stau, amestecate
 * printre motive, „Total liberați condamnați", „Total liberați deținuți" și
 * „Total Decedați". Acelea sunt plăci, nu felii. Decedații nu sunt nici ei
 * motive de liberare și nu intră în total, deci lipsesc din cerc.
 */
const LIBERATI_MOTIVE: ValueRef[] = [
  { indicator: "La executarea integrală a termenului de pedeapsă", label: "Termen executat" },
  {
    indicator: "Condiţionat de pedeapsă înainte de termen (Art. 91 CP)",
    label: "Art. 91 (condiționat)",
  },
  { indicator: "Graţiaţi (Art. 108 CP)", label: "Grațiați (art. 108)" },
  { indicator: "Amnistiaţi (Art. 107 CP)", label: "Amnistiați (art. 107)" },
  { indicator: "Pe motiv de boală (Art. 95 CP)", label: "Boală (art. 95)" },
  {
    indicator:
      "Cu înlocuirea părţii neexecutate a pedepsei cu o pedeapsă mai blândă (Art. 92 CP)",
    label: "Art. 92 (pedeapsă blândă)",
  },
  { indicator: "Achitați prin Deciziile CSJ,CA", label: "Achitați (CSJ/CA)" },
  { indicator: "Alte motive (art. 96CP, rejudecare și alte)", label: "Alte motive" },
  {
    indicator: "Art. 473/2 alin. (3) CPP (compensat, condiții de detenție)",
    label: "Mecanism compensatoriu",
  },
  { indicator: "Încetarea procesului penal", label: "Încetarea procesului" },
  {
    indicator: "Înlocuirea arestului preventiv cu o altă măsură preventivă",
    label: "Înlocuire arest preventiv",
  },
  {
    indicator: "În legătură cu revocarea arestului preventiv",
    label: "Revocare arest preventiv",
  },
  { indicator: "Expirarea termenului maxim prevăzut de lege", label: "Expirare termen legal" },
  {
    indicator: "Expirarea termenului stabilit de instanță",
    label: "Expirare termen instanță",
  },
  { indicator: "Achitarea persoanei", label: "Achitare" },
  {
    indicator:
      "Conform sentinței/deciziei de judecată condamnați la pedeapsa nonprivativă de libertate",
    label: "Pedeapsă neprivativă",
  },
  {
    indicator: "Scoaterea persoanei de sub urmărire penală",
    label: "Scoatere de sub urmărire",
  },
  // Preveniții amnistiați. Numele lor e chiar „Amnistiați", fără articol —
  // potrivirea exactă din `findValue` îi deosebește de condamnații de mai sus.
  { indicator: "Amnistiați", label: "Amnistiați (preveniți)" },
  {
    indicator: "Liberați în legătură cu executarea arestului contravențional",
    label: "Arest contravențional",
  },
];

const LIBERATI: ReportView = {
  title: "Liberări",
  tiles: [
    { indicator: "Total liberați deținuți", label: "Total liberați" },
    { indicator: "Total liberați condamnați", label: "Condamnați" },
    { indicator: "Total Decedați", label: "Decedați", tone: "bad" },
  ],
  charts: [
    {
      title: "Motivele liberării",
      kind: "categorical",
      composition: true,
      series: LIBERATI_MOTIVE,
    },
    {
      title: "Total liberați, pe perioade",
      kind: "line",
      series: [{ indicator: "Total liberați deținuți", label: "Total liberați" }],
    },
  ],
};

const COMISIA: ReportView = {
  title: "Comisia penitenciară",
  tiles: [
    {
      indicator: "Nr. persoanelor examinate la comisia penit. / art. 91 CP",
      series: "cumulat",
      label: "Examinați art. 91",
    },
    {
      indicator: "Nr. persoanelor examinate la comisia penit. / art. 92 CP",
      series: "cumulat",
      label: "Examinați art. 92",
    },
  ],
  charts: [
    {
      // Cumulatul, nu perioada: raportul se citește ca bilanț de la începutul
      // anului, iar rândul de perioadă are aceleași nume de indicatori.
      title: "Cereri examinate, admise și refuzate",
      kind: "grouped",
      groups: ["Examinați", "Admiși", "Refuzați"],
      series: [
        {
          indicator: "Nr. persoanelor examinate la comisia penit. / art. 91 CP",
          series: "cumulat",
          label: "art. 91",
          group: "Examinați",
        },
        {
          indicator: "Nr. persoanelor examinate la comisia penit. / art. 92 CP",
          series: "cumulat",
          label: "art. 92",
          group: "Examinați",
        },
        { indicator: "Admiși / art. 91 CP", series: "cumulat", label: "art. 91", group: "Admiși" },
        { indicator: "Admiși / art. 92 CP", series: "cumulat", label: "art. 92", group: "Admiși" },
        {
          indicator: "Refuzați / art. 91 CP",
          series: "cumulat",
          label: "art. 91",
          group: "Refuzați",
        },
        {
          indicator: "Refuzați / art. 92 CP",
          series: "cumulat",
          label: "art. 92",
          group: "Refuzați",
        },
      ],
    },
  ],
};

const GRATIERE: ReportView = {
  title: "Grațiere",
  tiles: [
    {
      indicator: "Total demersuri parvenite de la Aparatul Președintelui",
      label: "Demersuri parvenite",
    },
    { indicator: "Examinați de către AP / grațiați", label: "Grațiați", tone: "good" },
    { indicator: "Examinați de către AP / refuzați", label: "Refuzați", tone: "bad" },
  ],
  charts: [
    {
      // Pâlnie, nu compoziție: „parvenite" e totalul din care ies celelalte.
      // De aceea forma e fixată pe bare — într-un cerc, totalul ar apărea ca
      // felie lângă propriile lui părți.
      title: "Parcursul demersurilor de grațiere",
      kind: "categorical",
      form: "bars",
      series: [
        {
          indicator: "Total demersuri parvenite de la Aparatul Președintelui",
          label: "Parvenite",
        },
        { indicator: "Examinați condamnați de instituția penitenciară", label: "Examinați" },
        { indicator: "Examinați de către AP / grațiați", label: "Grațiați" },
        { indicator: "Examinați de către AP / refuzați", label: "Refuzați" },
      ],
    },
  ],
};

const SEDINTE: ReportView = {
  title: "Ședințe de judecată",
  tiles: [
    { indicator: "Total", label: "Total dispoziții" },
    { indicator: "Teleconferință / Total ședințe", label: "Prin teleconferință" },
  ],
  charts: [
    {
      // Fișierul scrie „Amînate"; grupul se numește totuși „Amânate", eticheta
      // fiind pentru cititor, nu pentru potrivire.
      title: "Teleconferință față de deplasare în instanță",
      kind: "grouped",
      groups: ["Total ședințe", "Prezenți", "Amânate"],
      series: [
        {
          indicator: "Teleconferință / Total ședințe",
          label: "Teleconferință",
          group: "Total ședințe",
        },
        {
          indicator: "Instanța de judecată / Total ședințe",
          label: "Instanță",
          group: "Total ședințe",
        },
        { indicator: "Teleconferință / Prezenți", label: "Teleconferință", group: "Prezenți" },
        {
          indicator: "Instanța de judecată / Prezenți în instanță",
          label: "Instanță",
          group: "Prezenți",
        },
        {
          indicator: "Teleconferință / Amînate ședințe",
          label: "Teleconferință",
          group: "Amânate",
        },
        {
          indicator: "Instanța de judecată / Amînate ședințe",
          label: "Instanță",
          group: "Amânate",
        },
      ],
    },
  ],
};

const MC_PERSOANE: ValueRef[] = [
  {
    indicator: "Eliberați din momentul primirii încheierii",
    series: "cumulat",
    label: "Eliberați imediat",
  },
  {
    indicator: "Eliberați după reducerea termenului",
    series: "cumulat",
    label: "Eliberați după reducere",
  },
];

/**
 * „Redus din termen" nu are unitate nicăieri în fișier: nici antet, nici notă,
 * nici rând de subsol. Titlul de deasupra coloanelor spune „Numărul de
 * deținuți…", ceea ce ar sugera tot persoane, dar nimic nu confirmă. De aceea
 * eticheta rămâne cea din fișier, fără „zile" sau „luni" inventate de noi.
 */
const MC_TERMEN: ValueRef = {
  indicator: "Redus din termen",
  series: "cumulat",
  label: "Redus din termen",
};

const MC: ReportView = {
  title: "Mecanism compensatoriu",
  tiles: [...MC_PERSOANE.map((ref) => ({ ...ref })), { ...MC_TERMEN }],
  charts: [
    {
      title: "Persoane eliberate",
      kind: "line",
      series: MC_PERSOANE.map((ref) => ({ ...ref })),
    },
    {
      // Grafic separat, nu din cochetărie: în iunie, 7 și 51 de persoane pe
      // aceeași axă cu 306 s-ar fi lipit de zero. Două mărimi de ordine
      // diferite nu împart o axă — și cu atât mai puțin când nu se știe sigur
      // dacă măsoară același lucru.
      title: "Redus din termen",
      kind: "line",
      series: [{ ...MC_TERMEN }],
    },
  ],
};

/**
 * Amnistiații pe articole, fără subtotaluri: „Total art. 12" și „Total art. 13"
 * sunt sumele literelor de sub ele, iar rândul „Total" e suma tuturor.
 */
const AMNISTIA_2016_ARTICOLE: ValueRef[] = [
  { indicator: "Numărul persoanelor amnistiate / art. 2", label: "art. 2" },
  { indicator: "Numărul persoanelor amnistiate / art. 6", label: "art. 6" },
  { indicator: "Numărul persoanelor amnistiate / art. 7", label: "art. 7" },
  { indicator: "Numărul persoanelor amnistiate / art. 8", label: "art. 8" },
  { indicator: "Numărul persoanelor amnistiate / art. 9", label: "art. 9" },
  { indicator: "Numărul persoanelor amnistiate / art. 11", label: "art. 11" },
  { indicator: "Numărul persoanelor amnistiate / Art. 12 / lit. a)", label: "art. 12 lit. a)" },
  { indicator: "Numărul persoanelor amnistiate / Art. 12 / lit. b)", label: "art. 12 lit. b)" },
  { indicator: "Numărul persoanelor amnistiate / Art. 12 / lit. c)", label: "art. 12 lit. c)" },
  { indicator: "Numărul persoanelor amnistiate / Art. 13 / lit. a)", label: "art. 13 lit. a)" },
  { indicator: "Numărul persoanelor amnistiate / Art. 13 / lit. b)", label: "art. 13 lit. b)" },
  { indicator: "Numărul persoanelor amnistiate / Art. 13 / lit. c)", label: "art. 13 lit. c)" },
];

const AMNISTIA_2016: ReportView = {
  title: "Amnistia 2016 (Legea nr. 210)",
  tiles: [
    // Prefixul se oprește înainte de „incideța" — fișierul scrie greșit
    // cuvântul, iar referința n-are de ce să repete greșeala.
    { indicator: "Nr. condamnaților care cad sub", label: "Sub incidența amnistiei" },
    { indicator: "Demersurile penitenciarului / Total", label: "Demersuri înaintate" },
    { indicator: "Numărul persoanelor amnistiate / Total liberați", label: "Liberați" },
  ],
  charts: [
    {
      title: "Materiale examinate la comisia penitenciarului",
      kind: "categorical",
      composition: true,
      series: [
        { indicator: "Materiale examinate la comisia penitenciarului / Admiși", label: "Admiși" },
        {
          indicator: "Materiale examinate la comisia penitenciarului / Refuzați",
          label: "Refuzați",
        },
      ],
    },
    {
      title: "Persoane amnistiate, pe articole",
      kind: "categorical",
      form: "hbars",
      composition: true,
      series: AMNISTIA_2016_ARTICOLE,
    },
  ],
};

/** Ca la 2016: „Total conform art. …" sunt sumele alineatelor de sub ele. */
const AMNISTIA_2021_ARTICOLE: ValueRef[] = [
  { indicator: "Numărul persoanelor amnistiate / Art.2 / alin.(1)", label: "art. 2 alin. (1)" },
  { indicator: "Numărul persoanelor amnistiate / Art.2 / alin.(2)", label: "art. 2 alin. (2)" },
  { indicator: "Numărul persoanelor amnistiate / Art.2 / alin.(3)", label: "art. 2 alin. (3)" },
  { indicator: "Numărul persoanelor amnistiate / Art.2 / alin.(4)", label: "art. 2 alin. (4)" },
  { indicator: "Numărul persoanelor amnistiate / Art.4 / alin.(1)", label: "art. 4 alin. (1)" },
  { indicator: "Numărul persoanelor amnistiate / Art.4 / alin.(2)", label: "art. 4 alin. (2)" },
  { indicator: "Numărul persoanelor amnistiate / Art.4 / alin.(3)", label: "art. 4 alin. (3)" },
  { indicator: "Numărul persoanelor amnistiate / Art.4 / alin.(4)", label: "art. 4 alin. (4)" },
  { indicator: "Numărul persoanelor amnistiate / Art.5", label: "art. 5" },
  {
    indicator: "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.a)",
    label: "art. 7 lit. a)",
  },
  {
    indicator: "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.b)",
    label: "art. 7 lit. b)",
  },
  {
    indicator: "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.c)",
    label: "art. 7 lit. c)",
  },
  {
    indicator: "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.d)",
    label: "art. 7 lit. d)",
  },
  {
    indicator: "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.e)",
    label: "art. 7 lit. e)",
  },
  {
    indicator: "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.f)",
    label: "art. 7 lit. f)",
  },
  {
    indicator: "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.g)",
    label: "art. 7 lit. g)",
  },
  { indicator: "Numărul persoanelor amnistiate / Art.8", label: "art. 8" },
  { indicator: "Numărul persoanelor amnistiate / Art.9", label: "art. 9" },
];

const AMNISTIA_2021: ReportView = {
  title: "Amnistia 2021",
  tiles: [
    { indicator: "Materiale examinate la Comisia specială / Total", label: "Examinați de comisie" },
    { indicator: "Demersurile penitenciarului / Total demersuri", label: "Demersuri înaintate" },
    { indicator: "Numărul persoanelor amnistiate / Total amnistiați", label: "Amnistiați" },
  ],
  charts: [
    {
      title: "Materiale examinate la Comisia specială",
      kind: "categorical",
      composition: true,
      series: [
        { indicator: "Materiale examinate la Comisia specială / Admiși", label: "Admiși" },
        { indicator: "Materiale examinate la Comisia specială / Refuzați", label: "Refuzați" },
      ],
    },
    {
      title: "Persoane amnistiate, pe articole",
      kind: "categorical",
      form: "hbars",
      composition: true,
      series: AMNISTIA_2021_ARTICOLE,
    },
  ],
};

/**
 * Configurația fiecărui raport. `Record<StatKind, …>` ține evidența: un al
 * nouălea tip de raport adăugat în `StatKind` nu compilează până nu-și
 * primește și graficele.
 */
export const REPORT_VIEWS: Record<StatKind, ReportView> = {
  r_lunar: R_LUNAR,
  liberati: LIBERATI,
  amnistia_2016: AMNISTIA_2016,
  amnistia_2021: AMNISTIA_2021,
  gratiere: GRATIERE,
  comisia: COMISIA,
  mc: MC,
  sedinte: SEDINTE,
};

export function viewFor(kind: StatKind): ReportView {
  return REPORT_VIEWS[kind];
}
