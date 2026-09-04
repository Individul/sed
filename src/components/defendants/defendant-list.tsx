"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Gavel, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DefendantDialog } from "@/components/defendants/defendant-dialog";
import { markConvicted, undoConvicted } from "@/app/inculpati/actions";
import {
  CATEGORY_LABEL,
  REGIME_LABEL,
  categoryOf,
  activeDefendants,
  convictedDefendants,
  countDefendants,
  fullName,
  type Defendant,
} from "@/lib/defendants";
import { parseISODate, toISODate } from "@/lib/periods";
import { fold } from "@/lib/text";
import { cn } from "@/lib/utils";

export function DefendantList({
  defendants,
  isAdmin,
}: {
  defendants: Defendant[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Defendant | null>(null);
  const [search, setSearch] = useState("");
  const [showConvicted, setShowConvicted] = useState(false);
  const [, startTransition] = useTransition();

  const counts = countDefendants(defendants);
  const q = fold(search.trim());
  const matches = (d: Defendant) =>
    !q || fold(fullName(d)).includes(q) || fold(d.case_number ?? "").includes(q);

  const activi = activeDefendants(defendants).filter(matches);
  const condamnati = convictedDefendants(defendants).filter(matches);

  const treci = (d: Defendant) => {
    const azi = toISODate(new Date());
    const data = window.prompt(
      `Data hotărârii pentru ${fullName(d)} (AAAA-LL-ZZ):`,
      azi,
    );
    if (!data) return;
    startTransition(async () => {
      const res = await markConvicted(d.id, data);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${fullName(d)} — trecut la condamnat.`);
      router.refresh();
    });
  };

  const readu = (d: Defendant) => {
    startTransition(async () => {
      const res = await undoConvicted(d.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${fullName(d)} — readus în listă.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/*
        Aceiași oameni, numărați în două feluri.
        „În evidență" e ancora: preveniți + inculpați îl dau, și tot el îl dau
        și închis + semiînchis. Fără ancoră, cinci cifre alăturate ar părea
        cinci grupuri deosebite, iar cine le-ar aduna ar număra fiecare om de
        două ori.
      */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "În evidență", value: counts.activi },
          { label: "Preveniți", value: counts.preveniti },
          { label: "Inculpați", value: counts.inculpati },
          { label: "Închis", value: counts.inchis },
          { label: "Semiînchis", value: counts.semiinchis },
          { label: "Trecuți la condamnat", value: counts.condamnati },
        ].map((s) => (
          <div key={s.label}>
            <div className="text-2xl font-medium tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută după nume sau dosar…"
          className="max-w-xs"
        />
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Adaugă inculpat
        </Button>
      </div>

      <Lista
        rows={activi}
        gol="Niciun inculpat în evidență."
        onEdit={(d) => {
          setEditing(d);
          setOpen(true);
        }}
        actiune={(d) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => treci(d)}
          >
            <Gavel className="mr-1 h-3.5 w-3.5" /> Condamnat
          </Button>
        )}
      />

      {counts.condamnati > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowConvicted((v) => !v)}
            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {showConvicted ? "Ascunde" : "Arată"} cei trecuți la condamnat (
            {counts.condamnati})
          </button>
          {showConvicted && (
            <div className="mt-3">
              <Lista
                rows={condamnati}
                gol="Nimeni."
                onEdit={(d) => {
                  setEditing(d);
                  setOpen(true);
                }}
                actiune={(d) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    title="Readu în lista de inculpați"
                    onClick={() => readu(d)}
                  >
                    <Undo2 className="mr-1 h-3.5 w-3.5" /> Readu
                  </Button>
                )}
              />
            </div>
          )}
        </div>
      )}

      <DefendantDialog
        open={open}
        onOpenChange={setOpen}
        defendant={editing}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function Lista({
  rows,
  gol,
  onEdit,
  actiune,
}: {
  rows: Defendant[];
  gol: string;
  onEdit: (d: Defendant) => void;
  actiune: (d: Defendant) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-4 py-10 text-center text-muted-foreground">
        {gol}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b bg-muted/30 px-3.5 py-2 text-[11px] font-medium text-muted-foreground">
        <span className="min-w-0 flex-1">Numele și instanța</span>
        <span className="w-24 shrink-0">Categoria</span>
        <span className="w-28 shrink-0">Tipul</span>
        <span className="w-28 shrink-0">Stabilit</span>
        <span className="w-28 shrink-0" aria-hidden />
      </div>
      <div className="divide-y">
        {rows.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-3.5 py-2 text-[13px]">
            <button
              type="button"
              onClick={() => onEdit(d)}
              className="min-w-0 flex-1 text-left hover:underline"
            >
              <span className="font-medium">{fullName(d)}</span>
              {d.court && <span className="ml-2 text-muted-foreground">{d.court}</span>}
              {d.case_number && (
                <span className="ml-2 text-muted-foreground">dosar {d.case_number}</span>
              )}
            </button>
            {/* Categoria înaintea tipului: ea spune ce fel de om e, tipul spune
                unde merge. Îngroșat cel cu măsură preventivă, ca la „Închis" —
                aceeași convenție, nu o culoare nouă cu alt înțeles. */}
            <span
              className={cn(
                "w-24 shrink-0",
                d.preventive_measure ? "font-medium" : "text-muted-foreground",
              )}
            >
              {CATEGORY_LABEL[categoryOf(d)]}
            </span>
            <span
              className={cn(
                "w-28 shrink-0",
                d.regime === "inchis" ? "font-medium" : "text-muted-foreground",
              )}
            >
              {REGIME_LABEL[d.regime]}
            </span>
            <span className="w-28 shrink-0 tabular-nums text-muted-foreground">
              {format(parseISODate(d.established_on), "d MMM yyyy", { locale: ro })}
            </span>
            <span className="flex w-28 shrink-0 justify-end">{actiune(d)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
