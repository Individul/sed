"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveRelease } from "@/app/raport-saptamanal/actions";
import { formatDateRo, parseISODate } from "@/lib/periods";
import { cn } from "@/lib/utils";
import type { Release } from "@/lib/types";

/** Din rândul din bază se citesc trei câmpuri; restul n-are ce căuta în browser. */
type Row = Pick<Release, "release_date" | "count" | "note">;

interface ReleaseEntryProps {
  /** Cele șapte zile ale săptămânii, marți→luni, AAAA-LL-ZZ. */
  days: string[];
  entered: Row[];
  /** Fals dacă registrul n-a răspuns — vezi `getReleases`. */
  available: boolean;
}

/**
 * Zona în care se completează eliberările săptămânii.
 *
 * `no-print`: e un formular, nu o cifră de raportat. Pe hârtie ar fi un rând de
 * câmpuri goale sub un document oficial.
 *
 * Ziua se alege din cele șapte, fiindcă doar ele intră în raportul deschis. Cifra
 * fiecărei zile se vede pe chip: „—" înseamnă zi necompletată, „0" înseamnă zi
 * verificată în care n-a ieșit nimeni. Sunt lucruri diferite și se scriu diferit.
 */
export function ReleaseEntry({ days, entered, available }: ReleaseEntryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Prima zi necompletată: e ce ai venit să faci marți dimineața. Dacă toate
  // sunt scrise, rămâne prima zi a săptămânii și butonul corectează.
  const [day, setDay] = useState(
    () => days.find((d) => !entered.some((r) => r.release_date === d)) ?? days[0],
  );
  const [count, setCount] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rowFor = (iso: string) => entered.find((r) => r.release_date === iso) ?? null;
  const current = rowFor(day);

  // Ziua aleasă își aduce cifra deja scrisă: salvarea corectează ziua, nu o
  // rescrie cu zeroul din câmpul gol.
  useEffect(() => {
    const row = entered.find((r) => r.release_date === day) ?? null;
    setError(null);
    setCount(String(row?.count ?? 0));
    setNote(row?.note ?? "");
  }, [day, entered]);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveRelease(day, count, note);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(`Eliberările din ${formatDateRo(day)} au fost salvate.`);
      router.refresh();
    });
  };

  const completate = days.filter((d) => rowFor(d)).length;

  if (!available) {
    return (
      <section className="no-print space-y-2 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-medium">Eliberări</h2>
        <p className="text-[13px] text-muted-foreground">
          Registrul nu poate fi citit, deci nici completat — vezi avertizarea de mai sus.
        </p>
      </section>
    );
  }

  return (
    <section className="no-print space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Eliberări</h2>
        <span className="text-[13px] text-muted-foreground">
          {completate} din {days.length} zile completate
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {days.map((iso) => {
          const row = rowFor(iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setDay(iso)}
              aria-pressed={iso === day}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                iso === day
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {format(parseISODate(iso), "EEE d MMM", { locale: ro })}
              <span className="ml-1.5 tabular-nums">{row ? row.count : "—"}</span>
            </button>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="release-count" className="text-xs text-muted-foreground">
            Eliberați — {formatDateRo(day)}
          </Label>
          <Input
            id="release-count"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className="w-28 tabular-nums"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>

        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <Label htmlFor="release-note" className="text-xs text-muted-foreground">
            Observații
          </Label>
          <Input
            id="release-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Opțional"
          />
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Se salvează..." : current ? "Corectează ziua" : "Salvează ziua"}
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
