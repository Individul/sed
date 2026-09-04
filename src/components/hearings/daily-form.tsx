"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveHearing } from "@/app/sedinte/actions";
import { computeIndicators, type Hearing } from "@/lib/hearings";
import { formatDateRo } from "@/lib/periods";

interface DailyFormProps {
  /** Ziua deschisă acum; goală dacă nu s-a introdus încă. */
  date: string;
  hearing: Hearing | null;
}

/** Cifra din formular, ca text, ca să nu forțeze un 0 în câmpul gol. */
type Field = "tc_petrecute" | "tc_amanate" | "ij_petrecute" | "ij_amanate";

const GROUPS: { title: string; fields: { key: Field; label: string }[] }[] = [
  {
    title: "Teleconferință",
    fields: [
      { key: "tc_petrecute", label: "Petrecute" },
      { key: "tc_amanate", label: "Amânate" },
    ],
  },
  {
    title: "Instanța de judecată",
    fields: [
      { key: "ij_petrecute", label: "Petrecute" },
      { key: "ij_amanate", label: "Amânate" },
    ],
  },
];

export function DailyForm({ date, hearing }: DailyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<Field, string>>({
    tc_petrecute: "0", tc_amanate: "0", ij_petrecute: "0", ij_amanate: "0",
  });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setValues({
      tc_petrecute: String(hearing?.tc_petrecute ?? 0),
      tc_amanate: String(hearing?.tc_amanate ?? 0),
      ij_petrecute: String(hearing?.ij_petrecute ?? 0),
      ij_amanate: String(hearing?.ij_amanate ?? 0),
    });
    setNote(hearing?.note ?? "");
  }, [hearing, date]);

  // Totalurile se recalculează pe măsură ce scrii — aceleași formule ca în
  // baza de date, deci ce vezi aici e ce se va salva.
  const live = computeIndicators({
    tc_petrecute: Number(values.tc_petrecute) || 0,
    tc_amanate: Number(values.tc_amanate) || 0,
    ij_petrecute: Number(values.ij_petrecute) || 0,
    ij_amanate: Number(values.ij_amanate) || 0,
  });
  const totalFor = (title: string) =>
    title === "Teleconferință" ? live.tc_total : live.ij_total;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveHearing({ session_date: date, ...values, note });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(`Ziua ${formatDateRo(date)} a fost salvată.`);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <div key={group.title} className="rounded-lg border p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-medium">{group.title}</h3>
              <span className="text-[13px] text-muted-foreground">
                Total <span className="font-medium tabular-nums text-foreground">
                  {totalFor(group.title)}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {group.fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key} className="text-xs text-muted-foreground">
                    {f.label}
                  </Label>
                  <Input
                    id={f.key}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    className="tabular-nums"
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between rounded-lg bg-muted/40 px-4 py-3">
        <span className="text-sm font-medium">Total general</span>
        <span className="text-2xl font-medium tabular-nums">{live.total}</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Observații</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opțional"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Se salvează..." : hearing ? "Salvează modificările" : "Salvează ziua"}
        </Button>
        {hearing && (
          <span className="text-[13px] text-muted-foreground">
            Zi deja introdusă — salvarea o corectează.
          </span>
        )}
      </div>
    </form>
  );
}
