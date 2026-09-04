"use client";

import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";

import type { SeriesPeriod } from "@/app/statistici/actions";
import { SERIES_LABEL } from "@/lib/stats/labels";
import {
  deriveTile,
  findValue,
  type ChartSpec,
  type ReportView,
  type TileSpec,
  type TileTone,
  type ValueRef,
} from "@/lib/stats/report-views";
import { hasBothSeries, hasMeaningfulValue } from "@/lib/stats/series";
import type { StatKind } from "@/lib/stats/types";
import { cn } from "@/lib/utils";

import { CategoricalChart, type CategoricalValue } from "./charts/categorical-chart";
import { GroupedBarChart, type GroupedSeries } from "./charts/grouped-bar-chart";
import { LineChart } from "./charts/line-chart";
import { formatNumber } from "./charts/chrome";

/**
 * Secțiunea unui raport: cifrele perioadei celei mai recente, graficele alese
 * pentru conținutul lui și, dedesubt, tabelul cu absolut tot ce s-a importat.
 *
 * Ce desenează nu se hotărăște aici, ci în `report-views.ts`; componenta doar
 * leagă configurația de date. Trei reguli o guvernează:
 *
 * 1. **O valoare care lipsește lipsește.** Un indicator neraportat nu devine 0:
 *    placa lui nu se arată deloc, iar din grafice iese.
 * 2. **Zero peste tot înseamnă zgomot.** Rapoartele au zeci de rânduri care nu
 *    s-au întâmplat niciodată; `hasMeaningfulValue` le ține în afara graficelor.
 * 3. **Nimic nu se ascunde.** Ce nu intră în grafice se găsește întreg în
 *    „Toate valorile" — prezentarea curatoriată nu are voie să fie singura cale
 *    către cifre.
 */

interface ReportSectionProps {
  kind: StatKind;
  view: ReportView;
  /** Perioadele raportului, în ordine cronologică (cum le dă `listSeries`). */
  periods: SeriesPeriod[];
}

/** Perioada, întreagă și în română: „30 iunie 2026". */
function formatPeriodLong(iso: string): string {
  return format(parseISO(iso), "d MMMM yyyy", { locale: ro });
}

export function ReportSection({ kind, view, periods }: ReportSectionProps) {
  // Ascendente, deci ultima e cea mai recentă: plăcile și graficele dintr-o
  // singură perioadă arată starea de acum, nu prima lună importată vreodată.
  const latest = periods.length > 0 ? periods[periods.length - 1] : null;

  return (
    <section id={`raport-${kind}`} className="scroll-mt-4 space-y-4">
      <header className="space-y-0.5">
        <h2 className="text-lg font-medium">{view.title}</h2>
        <p className="text-[13px] text-muted-foreground">
          {latest ? `la ${formatPeriodLong(latest.periodDate)}` : "Niciun raport importat."}
        </p>
      </header>

      {/* Fără perioade nu urmează nimic: nici plăci goale, nici rame de grafic. */}
      {latest && (
        <>
          <Tiles tiles={view.tiles} latest={latest} />
          <Charts charts={view.charts} periods={periods} latest={latest} />
          <AllValues latest={latest} />
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Plăcile                                                                     */
/* -------------------------------------------------------------------------- */

interface ResolvedTile {
  key: string;
  label: string;
  value: number;
  tone: TileTone;
}

/**
 * Plăcile perioadei curente. Cele fără valoare nu se arată deloc — nici „0",
 * nici „—": o placă mare care spune „—" ocupă locul unei cifre pe care nimeni
 * n-a raportat-o.
 *
 * `derive` (deocamdată doar suprapopularea) schimbă eticheta, semnul și tonul:
 * −5 se citește „Locuri libere 5", nu „Suprapopulare −5".
 */
function resolveTiles(tiles: TileSpec[], latest: SeriesPeriod): ResolvedTile[] {
  const resolved: ResolvedTile[] = [];
  for (const tile of tiles) {
    const raw = findValue(latest.values, tile);
    if (raw === null) continue;
    const derived = tile.derive ? deriveTile(tile.derive, raw) : null;
    resolved.push({
      key: `${tile.series ?? ""}::${tile.indicator}`,
      label: derived?.label ?? tile.label,
      // `??`, nu `||`: un 0 derivat („Locuri libere 0") rămâne 0.
      value: derived?.value ?? raw,
      tone: derived?.tone ?? tile.tone ?? "default",
    });
  }
  return resolved;
}

function Tiles({ tiles, latest }: { tiles: TileSpec[]; latest: SeriesPeriod }) {
  const resolved = resolveTiles(tiles, latest);
  if (resolved.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-4">
      {resolved.map((tile) => (
        <div key={tile.key}>
          <div
            className={cn(
              "text-2xl font-medium tabular-nums leading-none",
              // Tonul colorează doar o cifră care chiar s-a întâmplat: un zero
              // roșu („Decedați 0") ar striga o veste care nu există.
              tile.tone === "bad" && tile.value > 0 && "text-red-600",
              tile.tone === "good" && tile.value > 0 && "text-emerald-600",
            )}
          >
            {formatNumber(tile.value)}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Graficele                                                                   */
/* -------------------------------------------------------------------------- */

/** Valorile unui indicator în toate perioadele — baza filtrului „zero peste tot". */
function valuesAcross(periods: SeriesPeriod[], ref: ValueRef): (number | null)[] {
  return periods.map((period) => findValue(period.values, ref));
}

/**
 * Linia: seriile care au avut măcar o dată o valoare nenulă. Restul ies —
 * altfel graficul ar purta o linie lipită de zero de la un capăt la altul și o
 * legendă care o anunță.
 *
 * Referința (plafonul) trece prin același filtru: o bază punctată care nu se
 * desenează n-are ce căuta în legendă.
 *
 * Nu se cerne aici cazul „o singură perioadă": `LineChart` scrie el nota
 * potrivită, iar nota e mai bună decât tăcerea — spune de ce lipsește graficul.
 */
function lineChart(spec: ChartSpec, periods: SeriesPeriod[]): ReactNode {
  const series = spec.series.filter((ref) => hasMeaningfulValue(valuesAcross(periods, ref)));
  if (series.length === 0) return null;

  const reference =
    spec.reference && hasMeaningfulValue(valuesAcross(periods, spec.reference))
      ? spec.reference
      : undefined;

  return (
    <LineChart title={spec.title} periods={periods} series={series} reference={reference} />
  );
}

/**
 * Categorialul (cerc sau bare): mărimile unei singure perioade — cea curentă.
 *
 * Două cerneri, cu rosturi diferite: ce n-a fost raportat **acum** nu are ce
 * felie să primească, iar ce e 0 în **toate** perioadele e rândul mort al
 * raportului și nu merită nici măcar o intrare în legendă. Fără a doua, cercul
 * liberărilor ar avea cincisprezece felii, din care zece invizibile.
 *
 * Forma: cea cerută de configurație (barele grațierii, barele orizontale ale
 * amnistiilor) sau, în lipsa ei, cea aleasă de componentă după câte categorii
 * au rămas.
 */
function categoricalChart(
  spec: ChartSpec,
  periods: SeriesPeriod[],
  latest: SeriesPeriod,
): ReactNode {
  const values: CategoricalValue[] = [];
  for (const ref of spec.series) {
    const value = findValue(latest.values, ref);
    if (value === null) continue;
    if (!hasMeaningfulValue(valuesAcross(periods, ref))) continue;
    values.push({ label: ref.label, value });
  }
  if (values.length === 0) return null;

  return <CategoricalChart title={spec.title} values={values} form={spec.form} />;
}

/**
 * Barele grupate: pe fiecare grup de pe axă, câte o bară de fiecare serie.
 * Seriile ies din etichetele referințelor (art. 91 / art. 92, teleconferință /
 * instanță), iar valorile se așază **în ordinea grupurilor**, ca bara să cadă
 * unde trebuie.
 *
 * Aici filtrul de zerouri nu se aplică pe serie, ci pe grafic. Într-o
 * comparație, seria care e 0 peste tot e chiar răspunsul („zero ședințe prin
 * teleconferință"), iar scoaterea ei ar schimba pe furiș ce se compară. Se
 * renunță doar la seria fără nicio valoare în perioada curentă — o legendă fără
 * bare minte — și la graficul în care n-a rămas nimic de desenat.
 */
function groupedChart(spec: ChartSpec, latest: SeriesPeriod): ReactNode {
  const groups = spec.groups ?? [];
  if (groups.length === 0) return null;

  // Etichetele distincte, în ordinea primei apariții: culoarea unei serii nu
  // trebuie să sară de la un raport la altul.
  const labels: string[] = [];
  for (const ref of spec.series) {
    if (!labels.includes(ref.label)) labels.push(ref.label);
  }

  const series: GroupedSeries[] = labels.map((label) => ({
    label,
    values: groups.map((group) => {
      const ref = spec.series.find((r) => r.label === label && r.group === group);
      return ref ? findValue(latest.values, ref) : null;
    }),
  }));

  const drawn = series.filter((s) => s.values.some((value) => value !== null));
  if (drawn.length === 0) return null;
  // Totul pe zero: bare de înălțime nulă lângă o axă goală. Mai bine nimic.
  if (!hasMeaningfulValue(drawn.flatMap((s) => s.values))) return null;

  return <GroupedBarChart title={spec.title} groups={groups} series={drawn} />;
}

function chartNode(spec: ChartSpec, periods: SeriesPeriod[], latest: SeriesPeriod): ReactNode {
  switch (spec.kind) {
    case "line":
      return lineChart(spec, periods);
    case "categorical":
      return categoricalChart(spec, periods, latest);
    case "grouped":
      return groupedChart(spec, latest);
  }
}

function Charts({
  charts,
  periods,
  latest,
}: {
  charts: ChartSpec[];
  periods: SeriesPeriod[];
  latest: SeriesPeriod;
}) {
  // Graficul rămas fără nimic de desenat nu lasă în urmă o ramă goală.
  const drawn = charts
    .map((spec) => ({ spec, node: chartNode(spec, periods, latest) }))
    .filter((entry): entry is { spec: ChartSpec; node: ReactNode } => entry.node !== null);

  if (drawn.length === 0) return null;

  return (
    // `items-start`: barele orizontale ale amnistiei sunt de trei ori mai înalte
    // decât cercul de lângă ele, iar cardul scund nu are de ce să se întindă.
    <div className={cn("grid items-start gap-4", drawn.length > 1 && "xl:grid-cols-2")}>
      {drawn.map(({ spec, node }) => (
        // Suprafața cardului: graficele își desenează golurile dintre marcaje în
        // culoarea ei, deci nu au voie să stea pe fundalul paginii.
        <div key={spec.title} className="min-w-0 rounded-xl border bg-card p-4">
          {node}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toate valorile                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ieșirea de siguranță: tot ce s-a importat pentru perioada curentă, rând cu
 * rând, inclusiv zerourile scoase din grafice. Închis implicit, ca să nu
 * acopere prezentarea, dar mereu la un click distanță — o pagină curatoriată
 * care n-ar avea și asta ar fi o pagină care ascunde date.
 */
function AllValues({ latest }: { latest: SeriesPeriod }) {
  if (latest.values.length === 0) return null;

  /*
   * „Se referă la" apare doar unde raportul chiar are două serii — la comisia
   * penitenciară și la mecanismul compensatoriu. Celelalte șase n-au rând de
   * perioadă, deci parserul marchează totul „cumulat" din lipsă de altceva, iar
   * coloana ar scrie „de la începutul anului" lângă „Plafonul de detenție" —
   * ceva ce nimeni n-a raportat. Când toate rândurile spun același lucru, tăcem.
   */
  const showSeries = hasBothSeries(latest.values);

  return (
    <details className="overflow-hidden rounded-xl border bg-card">
      <summary className="cursor-pointer px-3.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50">
        Toate valorile ({latest.values.length})
      </summary>
      <div className="max-h-96 overflow-auto border-t">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-muted/30 text-[11px] font-medium text-muted-foreground">
            <tr>
              <th className="px-3.5 py-2 text-left font-medium">Indicator</th>
              {showSeries && (
                <th className="w-52 px-3 py-2 text-left font-medium">Se referă la</th>
              )}
              <th className="w-28 px-3.5 py-2 text-right font-medium">Valoare</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {latest.values.map((value, index) => (
              <tr key={`${value.series}::${value.indicator}::${index}`}>
                <td className="px-3.5 py-1.5">{value.indicator}</td>
                {showSeries && (
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {SERIES_LABEL[value.series]}
                  </td>
                )}
                <td className="px-3.5 py-1.5 text-right tabular-nums">
                  {formatNumber(value.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
