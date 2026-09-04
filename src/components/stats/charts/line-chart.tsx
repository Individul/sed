"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SeriesPeriod } from "@/app/statistici/actions";
import { findValue, type ValueRef } from "@/lib/stats/report-views";

import {
  ChartCanvas,
  ChartFrame,
  ChartLegend,
  ChartNote,
  TooltipCard,
  type LegendItem,
  type TooltipRow,
} from "./chart-frame";
import {
  ACTIVE_DOT_RADIUS,
  AXIS_TICK,
  CHART_HEIGHT,
  DOTS_UP_TO,
  DOT_RADIUS,
  HAIRLINE,
  LINE_WIDTH,
  MAX_SERIES,
  PALETTE,
  REFERENCE_DASH,
  REFERENCE_INK,
  SURFACE,
  SURFACE_GAP,
  formatNumber,
  formatPeriod,
} from "./chrome";

/**
 * Evoluția în timp: o linie pe serie, perioadele pe axa orizontală.
 *
 * Referința (plafonul de detenție) intră aici ca linie punctată gri, nu ca
 * serie: e reperul față de care se citește seria, nu încă o mărime de comparat.
 * Tocmai de aceea **nu consumă niciun slot din paletă** — culorile se atribuie
 * numai peste `series`, iar referința își ia cerneala din afara rotației.
 */

interface LineChartProps {
  title: string;
  periods: SeriesPeriod[];
  series: ValueRef[];
  reference?: ValueRef;
}

/** Cheia unei serii în punctele graficului. Indexul, nu eticheta: etichetele se repetă. */
const seriesKey = (index: number): string => `s${index}`;
/** Referința are cheia ei, în afara numerotării seriilor. */
const REFERENCE_KEY = "ref";

/** Un rând citit din date: rămâne tipat, ca tooltipul să nu umble prin `Point`. */
interface Row {
  period: string;
  values: (number | null)[];
  reference: number | null;
}

/** Același rând, aplatizat cum îl vrea recharts. */
type Point = Record<string, number | null | string>;

export function LineChart({ title, periods, series, reference }: LineChartProps) {
  /**
   * Cel mult opt serii desenate. A noua ar primi o culoare deja folosită, iar
   * cele două ar deveni imposibil de deosebit — mai bine lipsește decât să mintă.
   */
  const drawn = useMemo(() => series.slice(0, MAX_SERIES), [series]);

  const rows = useMemo<Row[]>(
    () =>
      periods.map((period) => ({
        period: period.periodDate,
        // Valoarea lipsă rămâne `null`, niciodată 0: un indicator neraportat nu
        // e un indicator ajuns la zero, iar linia se întrerupe acolo.
        values: drawn.map((ref) => findValue(period.values, ref)),
        reference: reference ? findValue(period.values, reference) : null,
      })),
    [periods, drawn, reference],
  );

  const points = useMemo<Point[]>(
    () =>
      rows.map((row) => {
        const point: Point = { period: row.period };
        row.values.forEach((value, index) => {
          point[seriesKey(index)] = value;
        });
        if (reference) point[REFERENCE_KEY] = row.reference;
        return point;
      }),
    [rows, reference],
  );

  /** Perioadele în care măcar o serie chiar a raportat ceva. */
  const withData = useMemo(
    () => rows.filter((row) => row.values.some((value) => value !== null)).length,
    [rows],
  );

  const legend = useMemo<LegendItem[]>(() => {
    const items: LegendItem[] = drawn.map((ref, index) => ({
      color: PALETTE[index],
      label: ref.label,
    }));
    // Scrisă în legendă ca reper, ca să nu fie citită drept a doua serie.
    if (reference) {
      items.push({ color: REFERENCE_INK, label: `${reference.label} (referință)`, dashed: true });
    }
    return items;
  }, [drawn, reference]);

  if (drawn.length === 0) {
    return (
      <ChartFrame title={title}>
        <ChartNote>Nicio serie de afișat.</ChartNote>
      </ChartFrame>
    );
  }

  /**
   * Un singur punct nu e o evoluție. Mai bine o notă decât un punct plutind
   * singur pe o axă a timpului care n-are ce arăta.
   */
  if (withData < 2) {
    return (
      <ChartFrame title={title}>
        <ChartNote>Un grafic în timp are nevoie de cel puțin două perioade.</ChartNote>
      </ChartFrame>
    );
  }

  const showDots = points.length <= DOTS_UP_TO;

  return (
    <ChartFrame title={title}>
      {/* Două sau mai multe marcaje de deosebit → legendă, mereu. */}
      {legend.length >= 2 && <ChartLegend items={legend} />}
      <ChartCanvas height={CHART_HEIGHT}>
        <RechartsLineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          {/* Grila: linie de păr solidă, o treaptă față de suprafață. */}
          <CartesianGrid vertical={false} stroke={HAIRLINE} strokeWidth={1} />
          <XAxis
            dataKey="period"
            tickFormatter={formatPeriod}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: HAIRLINE }}
            minTickGap={24}
          />
          {/* O singură axă a valorilor. Niciodată o a doua. */}
          <YAxis
            tickFormatter={(value: number) => formatNumber(value)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: HAIRLINE, strokeWidth: 1 }}
            content={(props) => {
              if (!props.active || props.label === undefined) return null;
              const period = String(props.label);
              const row = rows.find((r) => r.period === period);
              if (!row) return null;
              const tooltipRows: TooltipRow[] = drawn.map((ref, index) => ({
                color: PALETTE[index],
                label: ref.label,
                value: formatNumber(row.values[index]),
              }));
              if (reference) {
                tooltipRows.push({
                  color: REFERENCE_INK,
                  label: `${reference.label} (referință)`,
                  value: formatNumber(row.reference),
                  dashed: true,
                });
              }
              return <TooltipCard heading={formatPeriod(period)} rows={tooltipRows} />;
            }}
          />
          {drawn.map((ref, index) => (
            <Line
              key={seriesKey(index)}
              type="monotone"
              dataKey={seriesKey(index)}
              name={ref.label}
              stroke={PALETTE[index]}
              strokeWidth={LINE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              // Golurile rămân goluri: linia nu sare peste o perioadă neraportată.
              connectNulls={false}
              dot={
                showDots
                  ? {
                      r: DOT_RADIUS,
                      fill: PALETTE[index],
                      // Inelul în culoarea suprafeței ține punctul lizibil
                      // acolo unde se suprapune peste altă linie.
                      stroke: SURFACE,
                      strokeWidth: SURFACE_GAP,
                    }
                  : false
              }
              activeDot={{
                r: ACTIVE_DOT_RADIUS,
                fill: PALETTE[index],
                stroke: SURFACE,
                strokeWidth: SURFACE_GAP,
              }}
            />
          ))}
          {reference && (
            /*
             * Plafonul se schimbă de la o perioadă la alta, deci e o linie
             * desenată din date, nu o `ReferenceLine` orizontală. Punctată,
             * gri, fără punct: se citește ca prag, nu ca măsurătoare.
             */
            <Line
              key={REFERENCE_KEY}
              type="monotone"
              dataKey={REFERENCE_KEY}
              name={reference.label}
              stroke={REFERENCE_INK}
              strokeWidth={LINE_WIDTH}
              strokeDasharray={REFERENCE_DASH}
              connectNulls={false}
              dot={false}
              activeDot={false}
            />
          )}
        </RechartsLineChart>
      </ChartCanvas>
    </ChartFrame>
  );
}
