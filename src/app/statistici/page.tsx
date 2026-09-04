import { getCurrentProfile, getStatReports } from "@/lib/queries";
import { TestingWatermark } from "@/components/layout/testing-watermark";
import { ImportDialog } from "@/components/stats/import-dialog";
import { ReportSection } from "@/components/stats/report-section";
import { ReportsTable } from "@/components/stats/reports-table";
import { listSeries } from "@/app/statistici/actions";
import { REPORT_VIEWS } from "@/lib/stats/report-views";
import type { StatKind } from "@/lib/stats/types";

export const dynamic = "force-dynamic";

/**
 * Ordinea secțiunilor e ordinea configurației: populația penitenciară sus,
 * rapoartele de nișă jos. `Record<StatKind, …>` garantează că sunt toate opt.
 */
const KINDS = Object.keys(REPORT_VIEWS) as StatKind[];

export default async function StatisticiPage() {
  const [reports, currentProfile, series] = await Promise.all([
    getStatReports(),
    getCurrentProfile(),
    // Toate seriile deodată: opt citiri paralele, nu opt așteptări una după
    // alta. `listSeries` întoarce `[]` și când migrarea 0016 lipsește, deci
    // pagina rămâne în picioare — fiecare secțiune își arată starea goală.
    Promise.all(KINDS.map((kind) => listSeries(kind))),
  ]);
  const isAdmin = currentProfile?.role === "admin";

  return (
    <>
      {/*
       * `relative` întinde filigranul exact peste pagină; `isolate` îi ține
       * `z-10` închis aici, ca dialogul de import — randat în portal la nivelul
       * lui `body` — să rămână deasupra lui.
       */}
      <main className="relative isolate mx-auto max-w-[1800px] p-4 xl:px-10">
        <TestingWatermark />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Statistici</h1>
          {isAdmin && <ImportDialog />}
        </div>

        <div className="space-y-10">
          {KINDS.map((kind, index) => (
            <ReportSection
              key={kind}
              kind={kind}
              view={REPORT_VIEWS[kind]}
              periods={series[index]}
            />
          ))}
        </div>

        {/*
         * Evidența fișierelor, nu conținutul: cine intră pe pagină vine după
         * cifre, nu după lista de .xlsx-uri urcate. De aceea stă la urmă.
         */}
        <section className="mt-12 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Fișiere importate</h2>
          <ReportsTable reports={reports} isAdmin={isAdmin} />
        </section>
      </main>
    </>
  );
}
