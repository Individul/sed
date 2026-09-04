import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { getCurrentProfile, getHearings } from "@/lib/queries";
import { ReportToolbar } from "@/components/hearings/report-toolbar";
import { aggregate, computeIndicators, missingWorkdays } from "@/lib/hearings";
import {
  PERIODS,
  parseISODate,
  rangeForPeriod,
  rangeLabelRo,
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

export default async function RaportSedintePage({
  searchParams,
}: {
  searchParams: { perioada?: string; la?: string | string[] };
}) {
  const period = readPeriod(searchParams.perioada);

  /*
   * Perioada se alege, nu se impune.
   *
   * Înainte, ancora era `new Date()`: puteai alege felul perioadei, dar
   * întotdeauna pe cea curentă. Pe 1 septembrie, „Lună" însemna septembrie —
   * gol — iar august nu se putea vedea deloc, deși tocmai el se raportează.
   *
   * Ancora vine acum din adresă, deci raportul se poate lega, tipări și trimite
   * mai departe fără să se schimbe sub mâna cui îl deschide. Ziua de azi se ia
   * pe ora Republicii Moldova; pe Vercel serverul merge pe UTC, iar noaptea,
   * până la ora 3, „luna curentă" ar fi fost cea trecută.
   */
  const azi = todayInChisinau();
  const anchor = readAnchor(searchParams.la, azi);
  const range = rangeForPeriod(period, anchor);

  // „Înainte" se oprește la perioada în care ne aflăm: una care încă n-a venit
  // n-are ce raporta, iar un raport gol pe octombrie doar zăpăcește.
  const esteCurenta = range.from <= azi && azi <= range.to;

  const [hearings, profile] = await Promise.all([
    getHearings(toISODate(range.from), toISODate(range.to)),
    getCurrentProfile(),
  ]);

  // Zilele merg cronologic în raport: un document oficial se citește de la
  // început spre sfârșit, spre deosebire de registrul de pe ecran.
  const zile = [...hearings].sort((a, b) => a.session_date.localeCompare(b.session_date));
  const total = aggregate(zile);
  const lipsa = missingWorkdays(range, zile);

  const numar = (n: number) => <span className="tabular-nums">{n}</span>;

  return (
    <main className="mx-auto max-w-3xl p-6 print:max-w-none print:p-0">
      <ReportToolbar
        period={period}
        eticheta={rangeLabelRo(range)}
        inapoi={toISODate(shiftPeriod(period, anchor, -1))}
        inainte={esteCurenta ? null : toISODate(shiftPeriod(period, anchor, 1))}
      />

      <article className="space-y-6 text-[13px] leading-relaxed">
        <header className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground print:text-black">
            Secția evidența deținuți
          </p>
          <h1 className="text-lg font-semibold">
            Raport privind ședințele de judecată
          </h1>
          <p className="text-muted-foreground print:text-black">{rangeLabelRo(range)}</p>
        </header>

        <section>
          <h2 className="mb-2 text-sm font-medium">Indicatori</h2>
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-y">
                <th colSpan={2} className="bg-muted/40 px-3 py-1.5 text-left font-medium">
                  Teleconferință
                </th>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5 pl-6">Petrecute</td>
                <td className="w-24 px-3 py-1.5 text-right">{numar(total.tc_petrecute)}</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5 pl-6">Amânate</td>
                <td className="px-3 py-1.5 text-right">{numar(total.tc_amanate)}</td>
              </tr>
              <tr className="border-b font-medium">
                <td className="px-3 py-1.5 pl-6">Total</td>
                <td className="px-3 py-1.5 text-right">{numar(total.tc_total)}</td>
              </tr>

              <tr className="border-b">
                <th colSpan={2} className="bg-muted/40 px-3 py-1.5 text-left font-medium">
                  Instanța de judecată
                </th>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5 pl-6">Petrecute</td>
                <td className="px-3 py-1.5 text-right">{numar(total.ij_petrecute)}</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5 pl-6">Amânate</td>
                <td className="px-3 py-1.5 text-right">{numar(total.ij_amanate)}</td>
              </tr>
              <tr className="border-b font-medium">
                <td className="px-3 py-1.5 pl-6">Total</td>
                <td className="px-3 py-1.5 text-right">{numar(total.ij_total)}</td>
              </tr>

              <tr className="border-b-2 border-t-2 text-[14px] font-semibold">
                <td className="px-3 py-2">Total general</td>
                <td className="px-3 py-2 text-right">{numar(total.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium">Defalcare pe zile</h2>
          {zile.length === 0 ? (
            <p className="text-muted-foreground print:text-black">
              Nicio zi introdusă în perioada raportată.
            </p>
          ) : (
            <table className="w-full border-collapse">
              {/* `thead` se repetă pe fiecare pagină tipărită. */}
              <thead>
                <tr className="border-y bg-muted/40 text-left">
                  <th className="px-3 py-1.5 font-medium">Ziua</th>
                  <th className="px-2 py-1.5 text-right font-medium">TC petrecute</th>
                  <th className="px-2 py-1.5 text-right font-medium">TC amânate</th>
                  <th className="px-2 py-1.5 text-right font-medium">IJ petrecute</th>
                  <th className="px-2 py-1.5 text-right font-medium">IJ amânate</th>
                  <th className="px-3 py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {zile.map((h) => {
                  const i = computeIndicators(h);
                  return (
                    <tr key={h.id} className="break-inside-avoid border-b">
                      <td className="px-3 py-1">
                        {format(parseISODate(h.session_date), "EEEE, d MMMM yyyy", { locale: ro })}
                      </td>
                      <td className="px-2 py-1 text-right">{numar(h.tc_petrecute)}</td>
                      <td className="px-2 py-1 text-right">{numar(h.tc_amanate)}</td>
                      <td className="px-2 py-1 text-right">{numar(h.ij_petrecute)}</td>
                      <td className="px-2 py-1 text-right">{numar(h.ij_amanate)}</td>
                      <td className="px-3 py-1 text-right font-medium">{numar(i.total)}</td>
                    </tr>
                  );
                })}
                <tr className="border-b-2 border-t-2 font-semibold">
                  <td className="px-3 py-1.5">
                    Total — {zile.length} {zile.length === 1 ? "zi" : "zile"}
                  </td>
                  <td className="px-2 py-1.5 text-right">{numar(total.tc_petrecute)}</td>
                  <td className="px-2 py-1.5 text-right">{numar(total.tc_amanate)}</td>
                  <td className="px-2 py-1.5 text-right">{numar(total.ij_petrecute)}</td>
                  <td className="px-2 py-1.5 text-right">{numar(total.ij_amanate)}</td>
                  <td className="px-3 py-1.5 text-right">{numar(total.total)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        {/*
          Golul se tipărește odată cu cifrele: un raport care tace despre zilele
          necompletate lasă impresia că perioada e acoperită integral.
        */}
        {lipsa.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-1 text-sm font-medium">Zile lucrătoare fără date</h2>
            <p>
              {lipsa
                .map((iso) => format(parseISODate(iso), "d MMMM", { locale: ro }))
                .join(", ")}
              .
            </p>
          </section>
        )}

        <footer className="flex justify-between border-t pt-3 text-xs text-muted-foreground print:text-black">
          <span>Întocmit: {profile?.full_name ?? "—"}</span>
          {/* Ora Chișinăului, spusă explicit: serverul merge pe UTC, iar un
              document oficial cu ceasul dat cu 2-3 ore înapoi la fiecare
              tipărire ridică exact întrebările pe care nu le vrei la dosar. */}
          <span>
            {new Intl.DateTimeFormat("ro-RO", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "Europe/Chisinau",
            }).format(new Date())}
          </span>
        </footer>
      </article>
    </main>
  );
}
