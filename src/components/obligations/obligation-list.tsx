"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { AlertTriangle, Check, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markObligationDone, undoObligationDone } from "@/app/obligatii/actions";
import { sortPending, type Pending } from "@/lib/obligations";
import { parseISODate } from "@/lib/periods";
import { cn } from "@/lib/utils";

function ritm(p: Pending): string {
  const o = p.obligation;
  if (o.kind === "saptamanal") return "în fiecare vineri";
  if (o.kind === "lunar_ultima_zi") return "în ultima zi a lunii";
  return `până la data de ${o.day_of_month} a fiecărei luni`;
}

function termen(p: Pending): string {
  const zi = format(parseISODate(p.due), "d MMMM yyyy", { locale: ro });
  if (p.overdue) {
    const n = Math.abs(p.days);
    return `${zi} — restant de ${n} ${n === 1 ? "zi" : "zile"}`;
  }
  if (p.days === 0) return `${zi} — astăzi`;
  return `${zi} — peste ${p.days} ${p.days === 1 ? "zi" : "zile"}`;
}

export function ObligationList({ items }: { items: Pending[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const rows = sortPending(items);

  const bifeaza = (p: Pending) => {
    startTransition(async () => {
      const res = await markObligationDone(p.obligation.id, p.due);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Bifat.");
      router.refresh();
    });
  };

  // Care bifă se scoate decide serverul — ultima din evidență — nu un calcul
  // pe ceasul clientului: după o bifă pusă din timp, cele două nu coincid, iar
  // varianta pe client ștergea înregistrarea reală a lunii trecute. Mesajul
  // spune data scoasă, ca anularea să fie verificabilă dintr-o privire.
  const scoate = (p: Pending) => {
    startTransition(async () => {
      const res = await undoObligationDone(p.obligation.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.removed
          ? `Bifa de pe ${format(parseISODate(res.removed), "d MMMM", { locale: ro })} a fost scoasă.`
          : "Bifa a fost scoasă.",
      );
      router.refresh();
    });
  };

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nicio obligație înregistrată.</p>;
  }

  return (
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      {rows.map((p) => (
        <div key={p.obligation.id} className="flex items-start gap-3 px-4 py-3">
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
              p.overdue ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {p.overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">{p.obligation.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {p.obligation.recipient} · {ritm(p)}
            </p>
            <p
              className={cn(
                "mt-1 text-[13px]",
                p.overdue ? "font-medium text-red-600" : "text-muted-foreground",
              )}
            >
              {termen(p)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={p.overdue ? "default" : "outline"}
              className="h-8"
              disabled={isPending}
              onClick={() => bifeaza(p)}
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Expediat
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Scoate ultima bifă"
              aria-label="Scoate ultima bifă"
              disabled={isPending}
              onClick={() => scoate(p)}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
