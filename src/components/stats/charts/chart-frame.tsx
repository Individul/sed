"use client";

import type { ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Rama comună a graficelor: titlul, containerul, legenda, tooltipul și nota
 * pentru cazurile în care nu e nimic de desenat. Aceleași bucăți în toate trei,
 * ca să nu ajungă un grafic cu legenda într-un fel și altul în altul.
 */

interface ChartFrameProps {
  title: string;
  children: ReactNode;
}

/** Titlul stă deasupra graficului, în stilul obișnuit de subtitlu al aplicației. */
export function ChartFrame({ title, children }: ChartFrameProps) {
  return (
    // `min-w-0`: într-un grid sau flex, altfel refuză să se micșoreze și
    // graficul iese din card.
    <section className="min-w-0 space-y-2.5">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

interface ChartCanvasProps {
  height: number;
  children: ReactElement;
}

/**
 * Pânza: înălțime fixă (cu tot cu banda axei, ca etichetele de jos să nu ajungă
 * într-un scroll al lor) și lățime luată de la părinte.
 */
export function ChartCanvas({ height, children }: ChartCanvasProps) {
  return (
    <div className="min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/** Ce se scrie în locul graficului când nu e nimic de desenat. */
export function ChartNote({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-[13px] text-muted-foreground">{children}</p>;
}

/**
 * Cheia colorată de lângă text. Identitatea vine de la ea, nu de la textul
 * colorat: nuanțele deschise (galben, turcoaz) sunt ilizibile ca literă.
 */
function SeriesKey({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className="h-0.5 w-4 shrink-0 self-center rounded-full"
      style={
        dashed
          ? {
              backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)`,
            }
          : { backgroundColor: color }
      }
    />
  );
}

export interface LegendItem {
  color: string;
  label: string;
  /** Cercul e ilizibil fără cifre: la donut, legenda le poartă. */
  value?: string;
  dashed?: boolean;
}

/**
 * Legenda: prezentă ori de câte ori sunt două sau mai multe marcaje de
 * deosebit. E canalul de identitate pe care se poate conta — nimeni nu trebuie
 * să potrivească nuanțe din ochi.
 */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={`${item.label}-${item.color}`} className="flex items-baseline gap-1.5">
          <SeriesKey color={item.color} dashed={item.dashed} />
          <span className="text-[11px] text-muted-foreground">{item.label}</span>
          {item.value !== undefined && (
            <span className="text-[11px] font-medium tabular-nums text-foreground">
              {item.value}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Legenda cercului: o coloană lângă desen, cu eticheta și cifra pe același rând. */
export function ChartLegendColumn({ items }: { items: LegendItem[] }) {
  return (
    <ul className="min-w-0 space-y-1">
      {items.map((item) => (
        <li key={`${item.label}-${item.color}`} className="flex items-baseline gap-2">
          <SeriesKey color={item.color} dashed={item.dashed} />
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {item.label}
          </span>
          {item.value !== undefined && (
            <span className="shrink-0 text-[11px] font-medium tabular-nums text-foreground">
              {item.value}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface TooltipRow {
  color: string;
  /** Lipsește când titlul tooltipului spune deja despre ce e vorba (o felie, o bară). */
  label?: string;
  value: string;
  dashed?: boolean;
}

/**
 * Citirea la hover. Valoarea conduce, numele o urmează; culoarea stă în cheia
 * de alături, niciodată în literă.
 */
export function TooltipCard({ heading, rows }: { heading: string; rows: TooltipRow[] }) {
  return (
    <div className="max-w-[18rem] rounded-lg border bg-card px-3 py-2 shadow-md">
      <div className="mb-1.5 text-[11px] text-muted-foreground">{heading}</div>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={`${row.label ?? ""}-${row.color}`} className="flex items-baseline gap-2">
            <SeriesKey color={row.color} dashed={row.dashed} />
            <span className="text-[13px] font-medium tabular-nums text-foreground">
              {row.value}
            </span>
            {row.label !== undefined && (
              <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">{row.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
