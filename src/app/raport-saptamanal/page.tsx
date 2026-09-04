import Link from "next/link";
import { addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExportButtons } from "@/components/weekly/export-buttons";
import { ReleaseEntry } from "@/components/weekly/release-entry";
import { ReportView } from "@/components/weekly/report-view";
import { missingWorkdays } from "@/lib/hearings";
import { rangeLabelRo, toISODate, todayInChisinau, type DateRange } from "@/lib/periods";
import { getCurrentProfile, getHearings, getReleases, getTransfers } from "@/lib/queries";
import { readWeek, reportWeek, shiftWeek, weeklyFigures } from "@/lib/weekly-report";

export const dynamic = "force-dynamic";

const weekHref = (week: DateRange) => `/raport-saptamanal?saptamana=${toISODate(week.from)}`;

export default async function RaportSaptamanalPage({
  searchParams,
}: {
  // `string[]`, nu `string`, când parametrul apare de mai multe ori în adresă:
  // așa îl dă Next, iar `readWeek` ia prima valoare — exact ca
  // `URLSearchParams.get()` în ruta PDF, ca cele două să nu poată diverge.
  searchParams: { saptamana?: string | string[] };
}) {
  // O singură citire a ceasului pentru toată pagina: la 23:59:59 săptămâna și
  // zilele lipsă s-ar putea calcula de-o parte și de alta a miezului nopții.
  const now = new Date();
  // Ziua se ia pe calendarul Chișinăului, nu pe ceasul serverului: pe Vercel
  // el merge pe UTC, iar până la ora 3 dimineața la noi acolo e încă ieri —
  // adică raportul săptămânii trecute chiar în dimineața prezentării.
  const today = todayInChisinau(now);
  const current = reportWeek(today);
  const week = readWeek(searchParams.saptamana, current);
  const from = toISODate(week.from);
  const to = toISODate(week.to);

  const [profile, hearings, transfers, releases] = await Promise.all([
    getCurrentProfile(),
    getHearings(from, to),
    getTransfers(),
    getReleases(from, to),
  ]);

  // Toate patru cifrele ies de aici, dintr-un singur loc — la fel ca cele din
  // PDF. Pagina nu adună nimic pe cont propriu.
  const figures = weeklyFigures(week, { transfers, hearings, releases: releases.rows });
  const missing = missingWorkdays(week, hearings, today);

  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(week.from, i)));
  const isCurrent = from === toISODate(current.from);

  return (
    <>
      {/* Antetul aplicației nu are ce căuta pe hârtie. */}
      <div className="no-print">
      </div>

      <main className="mx-auto max-w-3xl space-y-6 p-4 xl:px-10 print:max-w-none print:p-0">
        <div className="no-print flex flex-wrap items-center gap-2 border-b pb-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Acasă
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            {!isCurrent && (
              <Button asChild variant="outline" size="sm" className="h-9">
                <Link href="/raport-saptamanal">Săptămâna curentă</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href={weekHref(shiftWeek(week, -1))} aria-label="Săptămâna precedentă">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="min-w-[13rem] text-center text-[13px] tabular-nums text-muted-foreground">
              {rangeLabelRo(week)}
            </span>
            {isCurrent ? (
              // Săptămâna curentă e ultima încheiată; înainte nu e nimic de arătat.
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled
                aria-label="Săptămâna următoare"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button asChild variant="outline" size="icon" className="h-9 w-9">
                <Link href={weekHref(shiftWeek(week, 1))} aria-label="Săptămâna următoare">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <ReportView
          week={week}
          figures={figures}
          missing={missing}
          releasesAvailable={releases.available}
          author={profile?.full_name ?? null}
          generatedAt={now}
        />

        {/* `key` pe săptămână: ziua aleasă e stare locală, iar la navigarea spre
            altă săptămână ar rămâne una care nu mai e în listă. */}
        <ReleaseEntry
          key={from}
          days={days}
          entered={releases.rows}
          available={releases.available}
        />

        <ExportButtons pdfHref={`/raport-saptamanal/pdf?saptamana=${from}`} />
      </main>
    </>
  );
}
