"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

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
  AXIS_TICK,
  BAR_MAX_SIZE,
  BAR_RADIUS_TOP,
  CHART_HEIGHT,
  HAIRLINE,
  MAX_SERIES,
  PALETTE,
  SURFACE_GAP,
  formatNumber,
} from "./chrome";

/**
 * Comparație între grupuri: pe fiecare grup de pe axă stau, una lângă alta,
 * barele seriilor.
 *
 * Grupate, nu stivuite: întrebarea e „cât are fiecare serie aici", nu „cât fac
 * împreună" — iar din stivă doar segmentul de jos se poate compara între grupuri.
 * Culoarea urmează seria, nu poziția barei în grup: aceeași serie păstrează
 * aceeași nuanță în toate grupurile.
 */

export interface GroupedSeries {
  label: string;
  /** Valorile, aliniate la `groups`. `null` = neraportat, nu zero. */
  values: (number | null)[];
}

interface GroupedBarChartProps {
  title: string;
  groups: string[];
  series: GroupedSeries[];
}

/** Cheia unei serii în rândurile graficului; indexul, ca etichetele să se poată repeta. */
const seriesKey = (index: number): string => `s${index}`;

type Row = Record<string, number | null | string>;

export function GroupedBarChart({ title, groups, series }: GroupedBarChartProps) {
  /** Cel mult opt serii: a noua ar relua o culoare deja folosită. */
  const drawn = useMemo(() => series.slice(0, MAX_SERIES), [series]);

  const rows = useMemo<Row[]>(
    () =>
      groups.map((group, groupIndex) => {
        const row: Row = { group };
        drawn.forEach((s, index) => {
          row[seriesKey(index)] = s.values[groupIndex] ?? null;
        });
        return row;
      }),
    [groups, drawn],
  );

  const legend = useMemo<LegendItem[]>(
    () => drawn.map((s, index) => ({ color: PALETTE[index], label: s.label })),
    [drawn],
  );

  const anyValue = drawn.some((s) => s.values.some((value) => value !== null && value !== undefined));

  if (groups.length === 0 || drawn.length === 0 || !anyValue) {
    return (
      <ChartFrame title={title}>
        <ChartNote>Nicio valoare.</ChartNote>
      </ChartFrame>
    );
  }

  return (
    <ChartFrame title={title}>
      {/* Legenda e singurul lucru care spune care bară e care serie — mereu prezentă. */}
      <ChartLegend items={legend} />
      <ChartCanvas height={CHART_HEIGHT}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
          // Golul de 2px, în culoarea suprafeței, dintre barele lipite ale
          // aceluiași grup. Nu un contur: doar spațiu.
          barGap={SURFACE_GAP}
        >
          <CartesianGrid vertical={false} stroke={HAIRLINE} strokeWidth={1} />
          <XAxis
            dataKey="group"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: HAIRLINE }}
            interval={0}
            height="auto"
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
            cursor={{ fill: HAIRLINE, fillOpacity: 0.35 }}
            content={(props) => {
              if (!props.active || props.label === undefined) return null;
              const group = String(props.label);
              const groupIndex = groups.indexOf(group);
              if (groupIndex < 0) return null;
              const tooltipRows: TooltipRow[] = drawn.map((s, index) => ({
                color: PALETTE[index],
                label: s.label,
                value: formatNumber(s.values[groupIndex]),
              }));
              return <TooltipCard heading={group} rows={tooltipRows} />;
            }}
          />
          {drawn.map((s, index) => (
            <Bar
              key={seriesKey(index)}
              dataKey={seriesKey(index)}
              name={s.label}
              fill={PALETTE[index]}
              maxBarSize={BAR_MAX_SIZE}
              // Capul rotunjit, baza dreaptă: bara crește dintr-o singură linie de zero.
              radius={BAR_RADIUS_TOP}
            />
          ))}
        </BarChart>
      </ChartCanvas>
    </ChartFrame>
  );
}
