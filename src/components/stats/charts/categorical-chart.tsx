"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { pickCategoricalForm, type CategoricalForm } from "@/lib/stats/report-views";

import {
  ChartCanvas,
  ChartFrame,
  ChartLegendColumn,
  ChartNote,
  TooltipCard,
  type LegendItem,
} from "./chart-frame";
import {
  AXIS_TICK,
  BARS_HEIGHT,
  BAR_MAX_SIZE,
  BAR_RADIUS_RIGHT,
  BAR_RADIUS_TOP,
  DONUT_HEIGHT,
  DONUT_INNER_PERCENT,
  DONUT_OUTER_PERCENT,
  HAIRLINE,
  HBAR_AXIS_BAND,
  INK_MUTED,
  MAX_SERIES,
  PALETTE,
  SURFACE,
  SURFACE_GAP,
  formatNumber,
  hbarRowHeight,
  labelAxisWidth,
  labelLineCount,
} from "./chrome";

/**
 * Mărimile unei singure perioade: părți dintr-un întreg sau o comparație între
 * categorii.
 *
 * Cercul dă identitate fiecărei felii, deci fiecare felie își ia un slot din
 * paletă — de aceea se folosește doar la puține categorii. Barele sunt altceva:
 * acolo categoriile n-au identități de ținut minte, ci o singură mărime citită
 * de-a lungul lor, așa că toate barele poartă **aceeași** nuanță (slotul 1).
 * A le colora după mărime ar cheltui canalul de identitate pe ceva ce lungimea
 * barei arată deja.
 *
 * Valorile zero sunt filtrate de apelant (`hasMeaningfulValue`); aici nu se mai
 * filtrează nimic — se tratează doar cazul în care n-a mai rămas nimic.
 */

export interface CategoricalValue {
  label: string;
  value: number;
}

interface CategoricalChartProps {
  title: string;
  values: CategoricalValue[];
  form?: CategoricalForm;
}

/** Rândul dat lui recharts: valoarea plus cifra deja formatată pentru etichetă. */
interface Row {
  label: string;
  value: number;
  display: string;
}

export function CategoricalChart({ title, values, form }: CategoricalChartProps) {
  const rows = useMemo<Row[]>(
    () => values.map((v) => ({ label: v.label, value: v.value, display: formatNumber(v.value) })),
    [values],
  );

  /**
   * Forma cerută sau, în lipsa ei, cea potrivită numărului de categorii.
   * Cercul cerut peste opt felii ar trebui să recicleze culori — nu o face:
   * trece pe bare, unde o singură nuanță ajunge pentru oricâte categorii.
   */
  const chosen = form ?? pickCategoricalForm(rows.length);
  const shape: CategoricalForm = chosen === "donut" && rows.length > MAX_SERIES ? "bars" : chosen;

  if (rows.length === 0) {
    return (
      <ChartFrame title={title}>
        <ChartNote>Nicio valoare.</ChartNote>
      </ChartFrame>
    );
  }

  if (shape === "donut") return <Donut title={title} rows={rows} />;
  return <Bars title={title} rows={rows} horizontal={shape === "hbars"} />;
}

function Donut({ title, rows }: { title: string; rows: Row[] }) {
  const legend: LegendItem[] = rows.map((row, index) => ({
    color: PALETTE[index],
    label: row.label,
    // Un cerc fără cifre nu se citește: legenda le poartă, lângă fiecare nuanță.
    value: row.display,
  }));

  return (
    <ChartFrame title={title}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="min-w-0 flex-1">
          <ChartCanvas height={DONUT_HEIGHT}>
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Tooltip
                content={(props) => {
                  if (!props.active) return null;
                  const name = props.payload?.[0]?.name;
                  const row =
                    typeof name === "string" ? rows.find((r) => r.label === name) : undefined;
                  if (!row) return null;
                  const index = rows.indexOf(row);
                  return (
                    <TooltipCard
                      heading={row.label}
                      rows={[{ color: PALETTE[index], value: row.display }]}
                    />
                  );
                }}
              />
              <Pie
                data={rows}
                dataKey="value"
                nameKey="label"
                innerRadius={`${DONUT_INNER_PERCENT}%`}
                outerRadius={`${DONUT_OUTER_PERCENT}%`}
                // Fără contur colorat în jurul feliei: doar golul în culoarea
                // suprafeței le desparte, la fel de lat peste tot.
                stroke={SURFACE}
                strokeWidth={SURFACE_GAP}
              >
                {rows.map((row, index) => (
                  <Cell key={row.label} fill={PALETTE[index]} />
                ))}
              </Pie>
            </PieChart>
          </ChartCanvas>
        </div>
        <div className="min-w-0 flex-1">
          <ChartLegendColumn items={legend} />
        </div>
      </div>
    </ChartFrame>
  );
}

function Bars({ title, rows, horizontal }: { title: string; rows: Row[]; horizontal: boolean }) {
  const labels = rows.map((row) => row.label);
  const axisWidth = labelAxisWidth(labels);
  /** O singură mărime de-a lungul categoriilor → o singură nuanță pe toate barele. */
  const fill = PALETTE[0];

  /**
   * Etichetele lungi se înghesuie pe orizontală; peste un prag se înclină, ca
   * să nu se suprapună și să nu fie retezate de marginea desenului.
   */
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  const tilt = !horizontal && (rows.length > 6 || longest > 12);

  /**
   * Barele orizontale nu se înghesuie într-o înălțime fixă: rândul crește cât
   * îi trebuie etichetei (una ruptă în două rânduri cere loc pentru două), iar
   * banda axei de jos e socotită separat, ca să nu fie tăiată.
   */
  const height = horizontal
    ? rows.length * hbarRowHeight(labelLineCount(labels, axisWidth)) + HBAR_AXIS_BAND
    : BARS_HEIGHT;

  return (
    <ChartFrame title={title}>
      <ChartCanvas height={height}>
        <BarChart
          data={rows}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{
            top: 12,
            // Cifra de la capătul barei orizontale are nevoie de loc în dreapta.
            right: horizontal ? 52 : 16,
            bottom: 4,
            left: 0,
          }}
        >
          {/* Grila merge perpendicular pe bare: linii verticale la barele
              orizontale, orizontale la coloane. */}
          <CartesianGrid
            horizontal={!horizontal}
            vertical={horizontal}
            stroke={HAIRLINE}
            strokeWidth={1}
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: HAIRLINE }}
              />
              {/*
               * Rostul barelor orizontale: eticheta **întreagă** stă lângă
               * bară. Nu se scurtează — ce nu încape pe un rând se rupe pe
               * cuvinte, iar rândul barei a fost făcut destul de înalt pentru
               * asta. Etichetele lungi din rapoarte sunt tot ce avem ca să știm
               * ce e fiecare bară.
               */}
              <YAxis
                type="category"
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={axisWidth}
                interval={0}
              />
            </>
          ) : (
            <>
              <XAxis
                type="category"
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: HAIRLINE }}
                interval={0}
                angle={tilt ? -35 : 0}
                textAnchor={tilt ? "end" : "middle"}
                height="auto"
              />
              <YAxis
                type="number"
                tickFormatter={(value: number) => formatNumber(value)}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={64}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: HAIRLINE, fillOpacity: 0.35 }}
            content={(props) => {
              if (!props.active || props.label === undefined) return null;
              const label = String(props.label);
              const row = rows.find((r) => r.label === label);
              if (!row) return null;
              return <TooltipCard heading={row.label} rows={[{ color: fill, value: row.display }]} />;
            }}
          />
          <Bar
            dataKey="value"
            name={title}
            fill={fill}
            maxBarSize={BAR_MAX_SIZE}
            // Capătul dinspre valoare rotunjit, baza dreaptă.
            radius={horizontal ? BAR_RADIUS_RIGHT : BAR_RADIUS_TOP}
          >
            {/*
             * Cifra la vârful barei: se citește fără mouse. E și canalul de
             * rezervă cerut de nuanțele care stau sub 3:1 față de suprafață.
             */}
            <LabelList
              dataKey="display"
              position={horizontal ? "right" : "top"}
              fill={INK_MUTED}
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ChartCanvas>
    </ChartFrame>
  );
}
