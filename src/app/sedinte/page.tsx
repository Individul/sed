import { Suspense } from "react";
import Link from "next/link";

import { getHearing, getHearings } from "@/lib/queries";
import { DailyForm } from "@/components/hearings/daily-form";
import { DayPicker } from "@/components/hearings/day-picker";
import { PeriodReport } from "@/components/hearings/period-report";
import {
  PERIODS,
  formatDateRo,
  rangeForPeriod,
  readAnchor,
  shiftPeriod,
  todayInChisinau,
  toISODate,
  type Period,
} from "@/lib/periods";

export const dynamic = "force-dynamic";

function readPeriod(value: string | undefined): Period {
  return PERIODS.some((p) => p.value === value) ? (value as Period) : "luna";
}

export default async function SedintePage({
  searchParams,
}: {
  searchParams: { perioada?: string; zi?: string; la?: string | string[] };
}) {
  const period = readPeriod(searchParams.perioada);
  // Ora Republicii Moldova, nu ceasul serverului: pe Vercel el merge pe UTC, iar
  // noaptea până la ora 3 „azi" ar fi ziua de ieri — atât la ziua de introdus,
  // cât și la perioada raportului.
  const azi = todayInChisinau();
  const today = toISODate(azi);
  // Ziua se ia din adresă, ca o zi anume să poată fi trimisă prin link. Se
  // limitează la azi și aici, nu doar în formular: adresa poate fi scrisă de mână.
  const requested = searchParams.zi ?? today;
  const day = requested > today ? today : requested;
  /*
   * Raportul de pe ecran se mută pe perioade din trecut, ca și cel de tipărit.
   *
   * Ancora a fost prima oară doar în versiunea de tipărit, iar aici a rămas
   * `new Date()` — adică perioada curentă, mereu. Pe 1 septembrie asta însemna
   * un raport gol pe septembrie, cu august de negăsit, iar singurul drum spre el
   * trecea printr-o legătură scrisă „Versiune de tipărit", unde nimeni n-are
   * motiv să caute o alegere de perioadă.
   */
  const anchor = readAnchor(searchParams.la, azi);
  const range = rangeForPeriod(period, anchor);
  const esteCurenta = range.from <= azi && azi <= range.to;

  const [hearing, hearings] = await Promise.all([
    getHearing(day),
    getHearings(toISODate(range.from), toISODate(range.to)),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-4 xl:px-10">
      <div>
        <h1 className="text-2xl font-semibold">Ședințe de judecată</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Evidența zilnică, cumulată pe toate judecătoriile.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Introducere — {formatDateRo(day)}</h2>
          <DayPicker day={day} today={today} />
        </div>
        <DailyForm date={day} hearing={hearing} />
      </section>

      <section className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Raport</h2>
          <Link
            // Duce cu ea și perioada aleasă: altfel, uitându-te la august și
            // apăsând „tipărește", ai primi septembrie.
            href={`/sedinte/raport?perioada=${period}&la=${toISODate(anchor)}`}
            // Roșu la cererea utilizatorului, ca legătura să sară în ochi.
            // Notă pentru cine trece pe aici: în restul aplicației roșul
            // înseamnă „restant" — dacă vreodată se face ordine în culori,
            // ăsta e locul care iese din rând, dinadins.
            className="text-[13px] font-medium text-red-600 transition-colors hover:text-red-700"
          >
            Versiune de tipărit →
          </Link>
        </div>
        <Suspense fallback={null}>
          <PeriodReport
            period={period}
            range={range}
            hearings={hearings}
            inapoi={toISODate(shiftPeriod(period, anchor, -1))}
            inainte={esteCurenta ? null : toISODate(shiftPeriod(period, anchor, 1))}
          />
        </Suspense>
      </section>
    </main>
  );
}
