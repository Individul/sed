import { STATUS_DOT, STATUS_OPTIONS } from "@/components/tasks/meta";
import { isTaskOverdue } from "@/lib/hub-stats";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

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

export function TaskSummary({ tasks, label = "Rezumat" }: { tasks: Task[]; label?: string }) {
  const total = tasks.length;
  // Rândurile ies din hartă, nu se enumeră: versiunea enumerată a uitat „în
  // așteptare" la adăugarea stării, iar 17 + 1 + 9 nu mai dădeau 41 — fără ca
  // cineva să poată spune unde s-au dus restul. Derivat, totalul se închide
  // prin construcție, inclusiv pentru orice stare viitoare.
  const byStatus = STATUS_OPTIONS.map((o) => ({
    ...o,
    dot: STATUS_DOT[o.value],
    count: tasks.filter((t) => t.status === o.value).length,
  }));
  const done = byStatus.find((s) => s.value === "done")?.count ?? 0;

  // `isTaskOverdue`, nu un calcul propriu: acesta scutește sarcinile în
  // așteptare, fiindcă un dosar plecat la instanță nu e restanța ta. Calculul
  // local de dinainte nu le scutea, așa că rezumatul arăta 8 restanțe acolo
  // unde bara laterală — care folosește filtrul comun — arăta 1. Două cifre
  // care se contrazic pe același ecran sunt mai rele decât o cifră lipsă.
  const overdue = tasks.filter((t) => isTaskOverdue(t)).length;

  const progress = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">{label}</h2>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Total" value={total} />
        {byStatus.map((s) => (
          <Stat key={s.value} label={s.label} value={s.count} dot={s.dot} />
        ))}
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
