import { describe, it, expect } from "vitest";
import { PARSERS } from "./registry";
import type { StatItem, StatKind } from "./types";
import type { ChartSpec, ReportView, ValueRef } from "./report-views";
import {
  REPORT_VIEWS,
  deriveTile,
  findValue,
  normalizeIndicator,
  pickCategoricalForm,
  viewFor,
} from "./report-views";

/**
 * Numele reale ale indicatorilor, culese rulând parserele peste dările de seamă
 * ale penitenciarului 6 (iunie 2026). Numele sunt reale, cifrele sunt inventate:
 * fișierele nu intră în depozit, dar configurația trebuie să se lege de ele.
 *
 * Lista e completă pe fiecare tip — inclusiv rândurile/coloanele care în iunie
 * n-au avut valoare („Examinați de către AP / grațiați"). Un ref din
 * configurație trebuie să se potrivească pe nume, nu pe norocul unei luni.
 */
const REAL_NAMES: Record<StatKind, string[]> = {
  r_lunar: [
    "Plafonul de detenție",
    "Persoane deținute",
    "Suprapopularea",
    "Din ei: / Femei",
    "Din ei: / Minori",
    "Din ei: / Minore",
    "Din ei: / Ex-funcționari publici",
    "Din ei: / Detențiune pe viață",
    "Persoane în arest prev",
    "Minori",
    "În arest contravenţional",
    "Noi arestați (Total)",
    "Săptămînal",
    "Încadrați în c/m",
    "LIBERAȚI / Total",
    "LIBERAȚI / Lunar",
    "LIBERAȚI / Condamnați",
    "LIBERAȚI / Preveniți",
    "LIBERAȚI / Arest contravențional",
    "Decedați (Total)",
    "Lunar",
    "Transferați din alte state",
    "Regim inițial / Art.246 CE",
    "Regim inițial / Intrarea sentinței în vigoare",
    "Deplas.fără escortă / deschis",
    "Deplas.fără escortă / semiînchis",
    "Deplas.fără escortă / închis",
  ],
  liberati: [
    "La executarea integrală a termenului de pedeapsă",
    "Condiţionat de pedeapsă înainte de termen (Art. 91 CP)",
    "Graţiaţi (Art. 108 CP)",
    "Amnistiaţi (Art. 107 CP)",
    "Pe motiv de boală (Art. 95 CP)",
    "Cu înlocuirea părţii neexecutate a pedepsei cu o pedeapsă mai blândă (Art. 92 CP)",
    "Achitați prin Deciziile CSJ,CA",
    "Alte motive (art. 96CP, rejudecare și alte)",
    "Art. 473/2 alin. (3) CPP (compensat, condiții de detenție)",
    "Total liberați condamnați",
    "Decedați condamnați",
    "Liberați Preveniți",
    "Încetarea procesului penal",
    "Înlocuirea arestului preventiv cu o altă măsură preventivă",
    "În legătură cu revocarea arestului preventiv",
    "Expirarea termenului maxim prevăzut de lege",
    "Expirarea termenului stabilit de instanță",
    "Achitarea persoanei",
    "Conform sentinței/deciziei de judecată condamnați la pedeapsa nonprivativă de libertate",
    "Scoaterea persoanei de sub urmărire penală",
    "Amnistiați",
    "Total Liberați preveniți",
    "Decedați preveniți",
    "Liberați cu arest contravențional",
    "Liberați în legătură cu executarea arestului contravențional",
    "Total liberați deținuți",
    "Total Decedați",
  ],
  amnistia_2016: [
    "Nr. condamnaților care cad sub incideța actului amnistiei la 09.09.2016",
    "Materiale examinate la comisia penitenciarului / Total",
    "Materiale examinate la comisia penitenciarului / Refuzați",
    "Materiale examinate la comisia penitenciarului / Admiși",
    "Materiale examinate la comisia penitenciarului",
    "Demersurile penitenciarului / Total",
    "Demersurile penitenciarului / art. 6",
    "Demersurile penitenciarului / art. 7",
    "Demersurile penitenciarului / art. 8",
    "Demersurile penitenciarului / art. 9",
    "Demersurile penitenciarului / art. 11",
    "Demersurile penitenciarului / Total art. 12",
    "Demersurile penitenciarului / Art. 12 / lit. a)",
    "Demersurile penitenciarului / Art. 12 / lit. b)",
    "Demersurile penitenciarului / Art. 12 / lit. c)",
    "Demersurile penitenciarului / Total art. 13",
    "Demersurile penitenciarului / Art. 13 / lit. a)",
    "Demersurile penitenciarului / Art. 13 / lit. b)",
    "Demersurile penitenciarului / Art. 13 / lit. c)",
    "Demersurile penitenciarului / Contestări înaintate / Total",
    "Demersurile penitenciarului / Contestări înaintate / Admiși",
    "Demersurile penitenciarului / Contestări înaintate / Respinși",
    "Total",
    "Numărul persoanelor amnistiate / Total liberați",
    "Numărul persoanelor amnistiate / art. 2",
    "Numărul persoanelor amnistiate / art. 6",
    "Numărul persoanelor amnistiate / art. 7",
    "Numărul persoanelor amnistiate / art. 8",
    "Numărul persoanelor amnistiate / art. 9",
    "Numărul persoanelor amnistiate / art. 11",
    "Numărul persoanelor amnistiate / Total art. 12",
    "Numărul persoanelor amnistiate / Art. 12 / lit. a)",
    "Numărul persoanelor amnistiate / Art. 12 / lit. b)",
    "Numărul persoanelor amnistiate / Art. 12 / lit. c)",
    "Numărul persoanelor amnistiate / Total art. 13",
    "Numărul persoanelor amnistiate / Art. 13 / lit. a)",
    "Numărul persoanelor amnistiate / Art. 13 / lit. b)",
    "Numărul persoanelor amnistiate / Art. 13 / lit. c)",
    "Alte noțiuni / Persoanele liberate care nu întrunesc condițiile Legii privind amnistia",
    "Alte noțiuni / Demersuri respinse de instanța de judecată",
    "Direcția evidență deținuți a ANP",
  ],
  amnistia_2021: [
    "Materiale examinate la Comisia specială / Total",
    "Materiale examinate la Comisia specială / Admiși",
    "Materiale examinate la Comisia specială / Refuzați",
    "Demersurile penitenciarului / Total demersuri",
    "Demersurile penitenciarului / Total conform art.4",
    "Demersurile penitenciarului / Art.4 / alin.(1)",
    "Demersurile penitenciarului / Art.4 / alin.(2)",
    "Demersurile penitenciarului / Art.4 / alin.(3)",
    "Demersurile penitenciarului / Art.4 / alin.(4)",
    "Demersurile penitenciarului / Art.5",
    "Demersurile penitenciarului / Total conform art.7 alin.(1)",
    "Demersurile penitenciarului / Art.7 alin.(1) / lit.a)",
    "Demersurile penitenciarului / Art.7 alin.(1) / lit.b)",
    "Demersurile penitenciarului / Art.7 alin.(1) / lit.c)",
    "Demersurile penitenciarului / Art.7 alin.(1) / lit.d)",
    "Demersurile penitenciarului / Art.7 alin.(1) / lit.e)",
    "Demersurile penitenciarului / Art.7 alin.(1) / lit.f)",
    "Demersurile penitenciarului / Art.7 alin.(1) / lit.g)",
    "Demersurile penitenciarului / Art.9",
    "Demersurile penitenciarului",
    "Numărul persoanelor amnistiate / Total amnistiați",
    "Numărul persoanelor amnistiate / Total conform art.2",
    "Numărul persoanelor amnistiate / Art.2 / alin.(1)",
    "Numărul persoanelor amnistiate / Art.2 / alin.(2)",
    "Numărul persoanelor amnistiate / Art.2 / alin.(3)",
    "Numărul persoanelor amnistiate / Art.2 / alin.(4)",
    "Numărul persoanelor amnistiate / Total conform art.4",
    "Numărul persoanelor amnistiate / Art.4 / alin.(1)",
    "Numărul persoanelor amnistiate / Art.4 / alin.(2)",
    "Numărul persoanelor amnistiate / Art.4 / alin.(3)",
    "Numărul persoanelor amnistiate / Art.4 / alin.(4)",
    "Numărul persoanelor amnistiate / Art.5",
    "Numărul persoanelor amnistiate / Total conform art.7 alin.(1)",
    "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.a)",
    "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.b)",
    "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.c)",
    "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.d)",
    "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.e)",
    "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.f)",
    "Numărul persoanelor amnistiate / Art.7 alin.(1) / lit.g)",
    "Numărul persoanelor amnistiate / Art.8",
    "Numărul persoanelor amnistiate / Art.9",
    "Acceptați de CS, însă refuzați de către instanța de judecată",
    "Refuzați de CS, însă amnistiați de instanța de judecată",
    "Total pasibili amnistiei",
  ],
  gratiere: [
    "Total demersuri parvenite de la Aparatul Președintelui",
    "Examinați condamnați de instituția penitenciară",
    "Urmează a fi examinți de instituția penitenciară",
    "Neexaminați de instituția penitenciară / nu au statut de condamnat",
    "Neexaminați de instituția penitenciară / nu sunt pasibili grațierii",
    "Neexaminați de instituția penitenciară / condamnatul a refuzat examinarea",
    "Examinați de către AP / grațiați",
    "Examinați de către AP / refuzați",
    "Neexaminați de către AP",
  ],
  comisia: [
    "Nr. persoanelor examinate la comisia penit. / art. 91 CP",
    "Nr. persoanelor examinate la comisia penit. / art. 92 CP",
    "Admiși / art. 91 CP",
    "Admiși / art. 92 CP",
    "Refuzați / art. 91 CP",
    "Refuzați / art. 92 CP",
    "Materiale expediate în judecată / art. 91 CP",
    "Materiale expediate în judecată / art. 92 CP",
    "Examinați în judecată / admiși / art. 91",
    "Examinați în judecată / respinși / art. 91",
    "Examinați în judecată / admiși / art. 92",
    "Examinați în judecată / respinși / art. 92",
    "Eliberați / cereri / art. 91",
    "Eliberați",
    "Eliberați / cereri / art.92",
  ],
  mc: [
    "Eliberați din momentul primirii încheierii",
    "Eliberați după reducerea termenului",
    "Redus din termen",
  ],
  sedinte: [
    "Total",
    "Teleconferință / Total ședințe",
    "Teleconferință / Prezenți",
    "Teleconferință / Examinați în lipsa lor",
    "Teleconferință / Amînate ședințe",
    "Sediul penitenciarului",
    "Instanța de judecată / Total ședințe",
    "Instanța de judecată / Prezenți în instanță",
    "Instanța de judecată / Examinați în lipsa lor",
    "Instanța de judecată / Amînate ședințe",
    "Organul de urmărire penală",
  ],
};

/** Rapoartele cu rând de perioadă: același nume apare cu două valori diferite. */
const BOTH_SERIES: StatKind[] = ["comisia", "mc"];

/** Valori sintetice peste nume reale: cumulatul e de zece ori perioada. */
function fixtureFor(kind: StatKind): StatItem[] {
  const both = BOTH_SERIES.includes(kind);
  return REAL_NAMES[kind].flatMap((indicator, i) => {
    const items: StatItem[] = [{ indicator, series: "cumulat", value: (i + 1) * 10 }];
    if (both) items.push({ indicator, series: "perioada", value: i + 1 });
    return items;
  });
}

/** Toate referințele unei configurații: plăci, serii de grafic și baza punctată. */
function allRefs(view: ReportView): ValueRef[] {
  const refs: ValueRef[] = [...view.tiles];
  for (const chart of view.charts) {
    refs.push(...chart.series);
    if (chart.reference) refs.push(chart.reference);
  }
  return refs;
}

function chartsOf(view: ReportView, kind: ChartSpec["kind"]): ChartSpec[] {
  return view.charts.filter((chart) => chart.kind === kind);
}

const KINDS: StatKind[] = PARSERS.map((parser) => parser.kind);

describe("normalizeIndicator", () => {
  it("scoate diacriticele, trece la litere mici și colapsează spațiile", () => {
    expect(normalizeIndicator("  Persoane   Deţinute \n")).toBe("persoane detinute");
    expect(normalizeIndicator("Șomaj Țară Ăsta Într-un Cârd")).toBe(
      "somaj tara asta intr-un card",
    );
  });

  it("aduce la aceeași formă sedila și virgula de sub s/t", () => {
    // Fișierele reale amestecă Amnistiaţi (sedilă) cu Amnistiați (virgulă).
    expect(normalizeIndicator("Amnistiaţi")).toBe(normalizeIndicator("Amnistiați"));
    expect(normalizeIndicator("Graţiaţi")).toBe("gratiati");
  });

  it("nu se supără pe șirul gol", () => {
    expect(normalizeIndicator("   ")).toBe("");
  });
});

describe("findValue", () => {
  const values: StatItem[] = [
    { indicator: "Persoane deținute", series: "cumulat", value: 748 },
    { indicator: "Suprapopularea", series: "cumulat", value: 0 },
    {
      indicator: "Art. 473/2 alin. (3) CPP (compensat, condiții de detenție)",
      series: "cumulat",
      value: 58,
    },
    { indicator: "Fără valoare", series: "cumulat", value: null },
    { indicator: "Admiși / art. 91 CP", series: "cumulat", value: 35 },
    { indicator: "Admiși / art. 91 CP", series: "perioada", value: 4 },
  ];

  it("găsește indicatorul după prefixul numelui", () => {
    expect(findValue(values, { indicator: "Art. 473/2", label: "MC" })).toBe(58);
  });

  it("nu se împiedică de diacritice sau de spații în plus", () => {
    expect(findValue(values, { indicator: "Persoane  deţinute", label: "Deținuți" })).toBe(748);
  });

  it("întoarce null când indicatorul lipsește, niciodată 0", () => {
    expect(findValue(values, { indicator: "Nu există așa ceva", label: "X" })).toBeNull();
  });

  it("păstrează zeroul raportat", () => {
    expect(findValue(values, { indicator: "Suprapopularea", label: "Suprapopulare" })).toBe(0);
  });

  it("întoarce null când indicatorul există, dar valoarea lipsește", () => {
    expect(findValue(values, { indicator: "Fără valoare", label: "X" })).toBeNull();
  });

  it("respectă seria cerută — același nume are două valori", () => {
    const ref: ValueRef = { indicator: "Admiși / art. 91 CP", label: "art. 91" };
    expect(findValue(values, { ...ref, series: "cumulat" })).toBe(35);
    expect(findValue(values, { ...ref, series: "perioada" })).toBe(4);
  });

  it("fără serie cerută ia prima potrivire", () => {
    expect(findValue(values, { indicator: "Admiși / art. 91 CP", label: "art. 91" })).toBe(35);
  });

  it("preferă potrivirea exactă în locul celei pe prefix", () => {
    // Cazul real din liberări: condamnații amnistiați au articolul în nume,
    // preveniții amnistiați au doar Amnistiați. Pe prefix ar câștiga primul.
    const ambigue: StatItem[] = [
      { indicator: "Amnistiaţi (Art. 107 CP)", series: "cumulat", value: 5 },
      { indicator: "Amnistiați", series: "cumulat", value: 9 },
    ];
    expect(findValue(ambigue, { indicator: "Amnistiați", label: "Amnistiați" })).toBe(9);
    expect(findValue(ambigue, { indicator: "Amnistiaţi (Art. 107 CP)", label: "x" })).toBe(5);
  });

  it("acceptă și un nume simplu în loc de referință", () => {
    expect(findValue(values, "Persoane deținute")).toBe(748);
    expect(findValue(values, "Nu există")).toBeNull();
  });

  it("nu găsește nimic într-o listă goală", () => {
    expect(findValue([], "Persoane deținute")).toBeNull();
  });
});

describe("pickCategoricalForm", () => {
  it("cerc pentru cel mult șase felii", () => {
    for (const n of [1, 2, 3, 4, 5, 6]) expect(pickCategoricalForm(n)).toBe("donut");
  });

  it("bare de la șapte în sus — un cerc cu douăsprezece felii nu se citește", () => {
    for (const n of [7, 8, 12, 19]) expect(pickCategoricalForm(n)).toBe("bars");
  });
});

describe("REPORT_VIEWS", () => {
  it("acoperă toate tipurile din registru, fără să inventeze altele", () => {
    expect(Object.keys(REPORT_VIEWS).sort()).toEqual([...KINDS].sort());
  });

  for (const kind of KINDS) {
    it(`«${kind}» are titlu, plăci și cel puțin un grafic`, () => {
      const view = viewFor(kind);
      expect(view.title.trim()).not.toBe("");
      expect(view.tiles.length).toBeGreaterThan(0);
      expect(view.charts.length).toBeGreaterThan(0);
      for (const chart of view.charts) {
        expect(chart.title.trim()).not.toBe("");
        expect(chart.series.length).toBeGreaterThan(0);
      }
    });
  }

  it("fiecare referință are o etichetă scurtă — numele brute nu încap pe axă", () => {
    for (const kind of KINDS) {
      for (const ref of allRefs(viewFor(kind))) {
        expect(ref.label.trim(), `${kind}: ${ref.indicator}`).not.toBe("");
        expect(ref.label.length, `${kind}: ${ref.label}`).toBeLessThanOrEqual(32);
      }
    }
  });

  it("baza punctată apare doar la graficele de linie", () => {
    for (const kind of KINDS) {
      for (const chart of viewFor(kind).charts) {
        if (chart.reference) expect(`${kind}: ${chart.kind}`).toBe(`${kind}: line`);
      }
    }
  });

  it("forma și compoziția se declară doar la graficele categoriale", () => {
    for (const kind of KINDS) {
      for (const chart of viewFor(kind).charts) {
        if (chart.kind === "categorical") continue;
        expect(chart.form, `${kind}: ${chart.title}`).toBeUndefined();
        expect(chart.composition, `${kind}: ${chart.title}`).toBeUndefined();
      }
    }
  });

  it("graficele grupate au matricea completă: fiecare grup, aceleași serii", () => {
    for (const kind of KINDS) {
      for (const chart of chartsOf(viewFor(kind), "grouped")) {
        const groups = chart.groups ?? [];
        expect(groups.length, `${kind}: ${chart.title}`).toBeGreaterThan(1);

        const perGroup = new Map<string, string[]>();
        for (const ref of chart.series) {
          expect(groups, `${kind}: ${ref.indicator}`).toContain(ref.group);
          const bucket = perGroup.get(ref.group ?? "") ?? [];
          bucket.push(ref.label);
          perGroup.set(ref.group ?? "", bucket);
        }

        expect([...perGroup.keys()].sort()).toEqual([...groups].sort());
        const seriesLabels = [...perGroup.values()].map((labels) => labels.sort().join("|"));
        expect(new Set(seriesLabels).size, `${kind}: ${chart.title}`).toBe(1);
      }
    }
  });

  it("grupurile apar doar la graficele grupate", () => {
    for (const kind of KINDS) {
      for (const chart of viewFor(kind).charts) {
        if (chart.kind !== "grouped") {
          expect(chart.groups, `${kind}: ${chart.title}`).toBeUndefined();
        }
      }
    }
  });
});

describe("referințele se rezolvă pe numele reale", () => {
  for (const kind of KINDS) {
    it(`«${kind}» — fiecare referință găsește un număr`, () => {
      const values = fixtureFor(kind);
      for (const ref of allRefs(viewFor(kind))) {
        const value = findValue(values, ref);
        expect(value, `${kind}: nu se rezolvă ${ref.indicator}`).not.toBeNull();
        expect(typeof value, `${kind}: ${ref.indicator}`).toBe("number");
      }
    });
  }

  it("nu rămâne niciun tip fără fixtură de nume reale", () => {
    for (const kind of KINDS) expect(REAL_NAMES[kind].length).toBeGreaterThan(0);
  });
});

describe("compoziții fără totaluri", () => {
  it("niciun grafic de compoziție nu conține un rând Total", () => {
    for (const kind of KINDS) {
      for (const chart of viewFor(kind).charts) {
        if (!chart.composition) continue;
        for (const ref of chart.series) {
          expect(
            normalizeIndicator(ref.indicator).includes("total"),
            `${kind}: ${ref.indicator} e un total într-o compoziție`,
          ).toBe(false);
        }
      }
    }
  });

  it("liberări: motivele sunt o compoziție, totalul stă pe placă", () => {
    const view = viewFor("liberati");
    const motive = chartsOf(view, "categorical")[0];
    expect(motive.composition).toBe(true);
    expect(view.tiles.some((t) => t.indicator === "Total liberați deținuți")).toBe(true);
  });

  it("grațiere: pâlnia nu e compoziție, deci are voie cu demersurile parvenite", () => {
    const chart = chartsOf(viewFor("gratiere"), "categorical")[0];
    expect(chart.composition).toBeFalsy();
    expect(chart.form).toBe("bars");
    expect(chart.series.some((r) => r.indicator.startsWith("Total demersuri"))).toBe(true);
  });
});

describe("deriveTile — suprapopularea", () => {
  it("negativul înseamnă locuri libere, nu o eroare de citire", () => {
    expect(deriveTile("suprapopulare", -5)).toEqual({
      label: "Locuri libere",
      value: 5,
      tone: "good",
    });
  });

  it("pozitivul înseamnă suprapopulare", () => {
    expect(deriveTile("suprapopulare", 12)).toEqual({
      label: "Suprapopulare",
      value: 12,
      tone: "bad",
    });
  });

  it("zero înseamnă plin la fix, tot locuri libere", () => {
    expect(deriveTile("suprapopulare", 0)).toEqual({
      label: "Locuri libere",
      value: 0,
      tone: "good",
    });
  });

  it("raportul lunar leagă placa a treia de Suprapopularea", () => {
    const tile = viewFor("r_lunar").tiles.find((t) => t.derive === "suprapopulare");
    expect(tile?.indicator).toBe("Suprapopularea");
  });
});

describe("configurațiile cerute de fiecare raport", () => {
  it("raport lunar: linia deținuților are plafonul ca bază punctată", () => {
    const line = chartsOf(viewFor("r_lunar"), "line")[0];
    expect(line.series).toHaveLength(1);
    expect(line.series[0].indicator).toBe("Persoane deținute");
    expect(line.reference?.indicator).toBe("Plafonul de detenție");
  });

  it("liberări: un grafic categorial pentru motive și o linie pentru total", () => {
    const view = viewFor("liberati");
    expect(chartsOf(view, "categorical")).toHaveLength(1);
    expect(chartsOf(view, "line")[0].series[0].indicator).toBe("Total liberați deținuți");
  });

  it("comisia: bare grupate pe examinați/admiși/refuzați, cu art. 91 și 92", () => {
    const chart = chartsOf(viewFor("comisia"), "grouped")[0];
    expect(chart.groups).toEqual(["Examinați", "Admiși", "Refuzați"]);
    expect(chart.series).toHaveLength(6);
    expect(chart.series.every((r) => r.series === "cumulat")).toBe(true);
  });

  it("ședințe: bare grupate teleconferință / instanță", () => {
    const chart = chartsOf(viewFor("sedinte"), "grouped")[0];
    expect(chart.series.map((r) => r.label)).toContain("Teleconferință");
    expect(chart.series.map((r) => r.label)).toContain("Instanță");
  });

  it("mecanism compensatoriu: persoanele și termenul redus stau pe grafice separate", () => {
    // 7 și 51 de persoane alături de 306 pe aceeași axă: cele două serii care
    // numără oameni s-ar turti la baza graficului. În plus, fișierul nu spune
    // în ce se măsoară „Redus din termen", deci nici nu se pot aduna.
    const linii = chartsOf(viewFor("mc"), "line");
    expect(linii).toHaveLength(2);

    expect(linii[0].series.map((ref) => ref.indicator)).toEqual([
      "Eliberați din momentul primirii încheierii",
      "Eliberați după reducerea termenului",
    ]);

    expect(linii[1].series).toHaveLength(1);
    expect(linii[1].series[0].indicator).toBe("Redus din termen");
  });

  it("mecanism compensatoriu: „Redus din termen” nu împarte axa cu nimeni", () => {
    for (const chart of viewFor("mc").charts) {
      const areTermen = chart.series.some((ref) => ref.indicator === "Redus din termen");
      if (areTermen) expect(chart.series, chart.title).toHaveLength(1);
    }
  });

  it("amnistiile: bare orizontale pe articole, etichetele sunt lungi", () => {
    for (const kind of ["amnistia_2016", "amnistia_2021"] as const) {
      const articole = chartsOf(viewFor(kind), "categorical").find((c) => c.form === "hbars");
      expect(articole, kind).toBeDefined();
      expect(articole?.composition, kind).toBe(true);
      expect((articole?.series.length ?? 0) > 6, kind).toBe(true);
    }
  });
});
