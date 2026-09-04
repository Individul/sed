"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { PeriodNav } from "./period-nav";
import {
  aggregate,
  computeIndicators,
  missingWorkdays,
  type Hearing,
} from "@/lib/hearings";
import {
  PERIODS,
  parseISODate,
  rangeLabelRo,
  type DateRange,
  type Period,
} from "@/lib/periods";

interface PeriodReportProps {
  period: Period;
  range: DateRange;
  hearings: Hearing[];
  /** Ancorele vecine, calculate pe server — vezi `PeriodNav`. */
  inapoi: string;
  inainte: string | null;
}

export function PeriodReport({
  period,
  range,
  hearings,
  inapoi,
  inainte,
}: PeriodReportProps) {
  const router = useRouter();
  const params = useSearchParams();

  const setPeriod = (next: Period) => {
    const q = new URLSearchParams(params.toString());
    q.set("perioada", next);
    router.push(`/sedinte?${q.toString()}`);
  };

  const total = aggregate(hearings);
  const zileCuDate = hearings.length;
  const lipsa = missingWorkdays(range, hearings);

  const dayHref = (iso: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("zi", iso);
    return `/sedinte?${q.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              p.value === period
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
        {/* Săgețile stau lângă butoanele de perioadă, unde omul se uită deja
            când alege ce vrea să vadă — nu ascunse în versiunea de tipărit. */}
        <div className="ml-auto">
          <PeriodNav
            basePath="/sedinte"
            eticheta={rangeLabelRo(range)}
            inapoi={inapoi}
            inainte={inainte}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total general", value: total.total },
          { label: "Teleconferință", value: total.tc_total },
          { label: "Instanța de judecată", value: total.ij_total },
          { label: "Petrecute", value: total.petrecute },
          { label: "Amânate", value: total.amanate },
        ].map((s) => (
          <div key={s.label}>
            <div className="text-2xl font-medium tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Golul e informația care nu se vede altundeva: o zi lucrătoare
          necompletată ar trece neobservată până la raportare. */}
      {lipsa.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <span className="font-medium">
            {lipsa.length} {lipsa.length === 1 ? "zi lucrătoare" : "zile lucrătoare"} fără date:
          </span>{" "}
          {lipsa.map((iso, i) => (
            <span key={iso}>
              {i > 0 && ", "}
              <Link href={dayHref(iso)} className="underline underline-offset-2">
                {format(parseISODate(iso), "d MMM", { locale: ro })}
              </Link>
            </span>
          ))}
          <span className="ml-1 text-amber-800/70">
            (sâmbetele și duminicile nu se numără; sărbătorile legale, da)
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b bg-muted/30 px-3.5 py-2 text-[11px] font-medium text-muted-foreground">
          <span className="min-w-0 flex-1">Ziua</span>
          <span className="w-20 shrink-0 text-right">TC petr.</span>
          <span className="w-20 shrink-0 text-right">TC amân.</span>
          <span className="w-20 shrink-0 text-right">IJ petr.</span>
          <span className="w-20 shrink-0 text-right">IJ amân.</span>
          <span className="w-16 shrink-0 text-right">Total</span>
        </div>

        {hearings.length ? (
          <div className="divide-y">
            {hearings.map((h) => {
              const i = computeIndicators(h);
              return (
                <div
                  key={h.id}
                  className="flex items-center gap-3 px-3.5 py-2 text-[13px] tabular-nums"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {format(parseISODate(h.session_date), "EEEE, d MMM yyyy", { locale: ro })}
                  </span>
                  <span className="w-20 shrink-0 text-right">{h.tc_petrecute}</span>
                  <span className="w-20 shrink-0 text-right">{h.tc_amanate}</span>
                  <span className="w-20 shrink-0 text-right">{h.ij_petrecute}</span>
                  <span className="w-20 shrink-0 text-right">{h.ij_amanate}</span>
                  <span className="w-16 shrink-0 text-right font-medium">{i.total}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-3 bg-muted/30 px-3.5 py-2 text-[13px] font-medium tabular-nums">
              <span className="min-w-0 flex-1">
                Total — {zileCuDate} {zileCuDate === 1 ? "zi" : "zile"}
              </span>
              <span className="w-20 shrink-0 text-right">{total.tc_petrecute}</span>
              <span className="w-20 shrink-0 text-right">{total.tc_amanate}</span>
              <span className="w-20 shrink-0 text-right">{total.ij_petrecute}</span>
              <span className="w-20 shrink-0 text-right">{total.ij_amanate}</span>
              <span className="w-16 shrink-0 text-right">{total.total}</span>
            </div>
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-muted-foreground">
            Nicio zi introdusă în perioada aleasă.
          </div>
        )}
      </div>
    </div>
  );
}
