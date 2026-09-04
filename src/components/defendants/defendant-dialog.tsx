"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteDefendant, saveDefendant } from "@/app/inculpati/actions";
import { COURTS } from "@/lib/courts";
import { REGIME_OPTIONS, type Defendant } from "@/lib/defendants";

const FARA_INSTANTA = "fara";

interface DefendantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defendant: Defendant | null;
  isAdmin: boolean;
}

export function DefendantDialog({
  open,
  onOpenChange,
  defendant,
  isAdmin,
}: DefendantDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [regime, setRegime] = useState<string>("");
  const [establishedOn, setEstablishedOn] = useState("");
  const [court, setCourt] = useState<string>(FARA_INSTANTA);
  const [caseNumber, setCaseNumber] = useState("");
  const [preventiveMeasure, setPreventiveMeasure] = useState(false);
  const [preventiveOn, setPreventiveOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLastName(defendant?.last_name ?? "");
    setFirstName(defendant?.first_name ?? "");
    setRegime(defendant?.regime ?? "");
    setEstablishedOn(defendant?.established_on ?? "");
    setPreventiveMeasure(defendant?.preventive_measure ?? false);
    setPreventiveOn(defendant?.preventive_measure_on ?? "");
    setCourt(defendant?.court ?? FARA_INSTANTA);
    setCaseNumber(defendant?.case_number ?? "");
    setNote(defendant?.note ?? "");
  }, [open, defendant]);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveDefendant(defendant?.id ?? null, {
        last_name: lastName,
        first_name: firstName,
        regime,
        established_on: establishedOn,
        preventive_measure: preventiveMeasure,
        // Data urmează măsura: scoasă bifa, data nu mai are ce descrie, iar
        // păstrată ar reintra în registru la următoarea bifare, tăcut și greșit.
        preventive_measure_on: preventiveMeasure ? preventiveOn : "",
        court: court === FARA_INSTANTA ? "" : court,
        case_number: caseNumber,
        note,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(defendant ? "Însemnare salvată." : "Inculpat adăugat.");
      onOpenChange(false);
      router.refresh();
    });
  };

  const remove = () => {
    if (!defendant) return;
    if (!window.confirm("Ștergi această însemnare din registru?")) return;
    startTransition(async () => {
      const res = await deleteDefendant(defendant.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Însemnare ștearsă.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{defendant ? "Editează însemnarea" : "Inculpat nou"}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-5"
        >
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="d-last">Nume</Label>
              <Input
                id="d-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-first">Prenume</Label>
              <Input
                id="d-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
          </div>

          {/*
            Măsura preventivă e ce deosebește un prevenit de un inculpat, deci
            stă la vedere, nu ascunsă printre observații. Categoria nu se alege:
            se citește de aici, ca să nu poată ajunge să spună altceva decât
            măsura însăși.
          */}
          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={preventiveMeasure}
                onChange={(e) => setPreventiveMeasure(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="font-medium">Are măsură preventivă</span>
              <span className="text-xs text-muted-foreground">
                {preventiveMeasure ? "→ prevenit" : "→ inculpat"}
              </span>
            </label>

            {preventiveMeasure && (
              <div className="space-y-1.5 pl-6.5">
                <Label htmlFor="d-preventive">Data măsurii (opțional)</Label>
                <Input
                  id="d-preventive"
                  type="date"
                  value={preventiveOn}
                  onChange={(e) => setPreventiveOn(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Tipul de penitenciar stabilit</Label>
              <Select value={regime} onValueChange={setRegime}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege tipul" />
                </SelectTrigger>
                <SelectContent>
                  {REGIME_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-established">Data stabilirii</Label>
              <Input
                id="d-established"
                type="date"
                value={establishedOn}
                onChange={(e) => setEstablishedOn(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Instanța</Label>
            <Select value={court} onValueChange={setCourt}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={FARA_INSTANTA}>— fără —</SelectItem>
                {COURTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="d-case">Numărul dosarului</Label>
            <Input
              id="d-case"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder="Opțional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="d-note">Observații</Label>
            <Textarea
              id="d-note"
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

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {defendant && isAdmin && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={remove}
                  disabled={isPending}
                >
                  Șterge
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Anulează
              </Button>
              <Button type="submit" disabled={isPending}>
                {defendant ? "Salvează" : "Adaugă"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
