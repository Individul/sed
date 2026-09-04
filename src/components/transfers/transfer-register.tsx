"use client";

import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateRo, parseISODate } from "@/lib/periods";
import { aggregate, institutionLabel } from "@/lib/transfers";
import type { Transfer } from "@/lib/types";

interface TransferRegisterProps {
  /** Rândurile perioadei, în ordinea interogării: ziua descrescător, instituția crescător. */
  rows: Transfer[];
  onEdit: (transfer: Transfer) => void;
}

interface Day {
  date: string;
  rows: Transfer[];
}

/** Zilele, în ordinea în care vin rândurile — deja de la cea mai recentă. */
function groupByDay(rows: Transfer[]): Day[] {
  const days: Day[] = [];
  for (const row of rows) {
    const last = days[days.length - 1];
    if (last && last.date === row.transfer_date) last.rows.push(row);
    else days.push({ date: row.transfer_date, rows: [row] });
  }
  return days;
}

/**
 * Etichetele zilei. De obicei una singură, dar o zi programată poate avea și o
 * mișcare urgentă, iar atunci ziua e amândouă.
 */
function kindsOf(rows: Transfer[]): Transfer["kind"][] {
  return (["planificat", "urgent"] as const).filter((k) => rows.some((r) => r.kind === k));
}

/** Unde nu s-a mișcat nimeni se pune „—": lipsa mișcării nu e o mișcare de zero. */
function Count({ value }: { value: number }) {
  return value > 0 ? <>{value}</> : <span className="text-muted-foreground">—</span>;
}

export function TransferRegister({ rows, onEdit }: TransferRegisterProps) {
  const days = groupByDay(rows);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Direcția stă în antet, ca formă și cuvânt deodată: săgeata în sus e
          plecarea, cea în jos sosirea, indiferent de culoare.

          Fără fundal: umbrirea înseamnă un singur lucru în tabelul ăsta —
          „aici începe o zi". Pusă și pe rândul de etichete, ar spune două. */}
      <div className="flex items-center gap-3 border-b px-3.5 py-2 text-[11px] font-medium text-muted-foreground">
        <span className="min-w-0 flex-1">Ziua / penitenciarul</span>
        <span className="flex w-24 shrink-0 items-center justify-end gap-1">
          <ArrowUp className="h-3 w-3 text-red-600" aria-hidden="true" />
          Plecați
        </span>
        <span className="flex w-24 shrink-0 items-center justify-end gap-1">
          <ArrowDown className="h-3 w-3 text-green-600" aria-hidden="true" />
          Sosiți
        </span>
      </div>

      {days.length ? (
        <div className="divide-y">
          {days.map((day) => {
            const totals = aggregate(day.rows);
            return (
              <div key={day.date}>
                <div className="flex items-center gap-2 border-b bg-muted/30 px-3.5 py-2 text-[13px]">
                  <span className="font-medium">{formatDateRo(day.date)}</span>
                  <span className="text-muted-foreground">
                    {format(parseISODate(day.date), "EEEE", { locale: ro })}
                  </span>
                  {kindsOf(day.rows).map((kind) =>
                    kind === "planificat" ? (
                      <Badge key={kind} variant="secondary">
                        Planificat
                      </Badge>
                    ) : (
                      <Badge
                        key={kind}
                        className="border-transparent bg-amber-100 text-amber-900"
                      >
                        Urgent
                      </Badge>
                    ),
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-3 tabular-nums">
                    <span className="w-24 text-right font-medium">
                      <Count value={totals.plecati} />
                    </span>
                    <span className="w-24 text-right font-medium">
                      <Count value={totals.sositi} />
                    </span>
                  </span>
                </div>

                <div className="divide-y">
                  {day.rows.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onEdit(t)}
                      title="Deschide rândul"
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13px] tabular-nums transition-colors hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {institutionLabel(t.institution)}
                        {t.note && (
                          <span className="ml-2 text-muted-foreground">· {t.note}</span>
                        )}
                      </span>
                      <span className="w-24 shrink-0 text-right">
                        <Count value={t.plecati} />
                      </span>
                      <span className="w-24 shrink-0 text-right">
                        <Count value={t.sositi} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-12 text-center text-muted-foreground">
          Niciun transfer în perioada aleasă.
        </div>
      )}
    </div>
  );
}
