import { STATUS_DOT } from "@/components/petitions/meta";
import { isPetitionOverdue } from "@/lib/hub-stats";
import { cn } from "@/lib/utils";
import type { Petition } from "@/lib/types";

function Stat({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-2xl font-medium tabular-nums leading-none">{value}</div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {dot ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden /> : null}
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}

export function PetitionSummary({
  petitions,
  label = "Rezumat",
}: {
  petitions: Petition[];
  label?: string;
}) {
  const total = petitions.length;
  const inExamination = petitions.filter((p) => p.status === "in_examinare").length;
  const solved = petitions.filter((p) => p.status === "solutionat").length;
  const overdue = petitions.filter((p) => isPetitionOverdue(p)).length;

  const progress = total ? Math.round((solved / total) * 100) : 0;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">{label}</h2>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Total" value={total} />
        <Stat label="În examinare" value={inExamination} dot={STATUS_DOT.in_examinare} />
        <Stat label="Soluționate" value={solved} dot={STATUS_DOT.solutionat} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Restante</span>
        <span className={cn("font-medium tabular-nums", overdue > 0 && "text-red-600")}>
          {overdue}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progres</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
