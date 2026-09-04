import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { formatDateRo, rangeLabelRo, type DateRange } from "@/lib/periods";
import { aggregate, missingScheduled, nextScheduled } from "@/lib/transfers";
import type { Transfer } from "@/lib/types";

interface TransferSummaryProps {
  /** Rândurile din perioada aleasă. */
  rows: Transfer[];
  range: DateRange;
  /** Ziua curentă, venită de la server. */
  today: Date;
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-2xl font-medium tabular-nums">
        {children}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** Lipsa mișcării nu e o mișcare de zero: unde n-a plecat/sosit nimeni se pune „—". */
function NoMovement() {
  return <span className="text-muted-foreground">—</span>;
}

/**
 * Cifrele perioadei și starea zilelor programate.
 *
 * Săgețile diferă și ca direcție, nu doar ca culoare: cine nu distinge roșul de
 * verde citește corect după formă.
 */
export function TransferSummary({ rows, range, today }: TransferSummaryProps) {
  const totals = aggregate(rows);
  const missing = missingScheduled(range, rows, today);
  const next = nextScheduled(today);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 text-[13px] text-muted-foreground">{rangeLabelRo(range)}</div>
        <div className="grid grid-cols-3 gap-4">
          <Tile label="Plecați">
            {totals.plecati > 0 ? (
              <>
                <ArrowUp className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                {totals.plecati}
              </>
            ) : (
              <NoMovement />
            )}
          </Tile>
          <Tile label="Sosiți">
            {totals.sositi > 0 ? (
              <>
                <ArrowDown className="h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                {totals.sositi}
              </>
            ) : (
              <NoMovement />
            )}
          </Tile>
          {/* Soldul e o diferență, nu o mișcare: pe o perioadă cu rânduri, un 0
              real înseamnă „au venit câți au plecat" și se scrie 0. */}
          <Tile label="Sold (sosiți − plecați)">
            {rows.length > 0 ? (
              totals.sold > 0 ? `+${totals.sold}` : String(totals.sold)
            ) : (
              <NoMovement />
            )}
          </Tile>
        </div>
      </div>

      {/* Golul e informația care nu se vede altundeva: o zi programată
          necompletată n-ar apărea nicăieri în registru. */}
      {missing.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          {missing.length === 1 ? (
            <>
              Ziua programată <span className="font-medium">{formatDateRo(missing[0])}</span>{" "}
              n-a fost completată.
            </>
          ) : (
            <>
              Zilele programate{" "}
              <span className="font-medium">
                {missing.map((iso) => formatDateRo(iso)).join(", ")}
              </span>{" "}
              n-au fost completate.
            </>
          )}{" "}
          Următorul transfer: {formatDateRo(next)}.
        </div>
      ) : (
        <p className="px-1 text-[13px] text-muted-foreground">
          Următorul transfer: {formatDateRo(next)}.
        </p>
      )}
    </div>
  );
}
