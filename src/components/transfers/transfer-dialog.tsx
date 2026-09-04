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
import {
  createTransfer,
  deleteTransfer,
  updateTransfer,
} from "@/app/transferuri/actions";
import { INSTITUTIONS, institutionLabel, isScheduled } from "@/lib/transfers";
import { parseISODate } from "@/lib/periods";
import type { Transfer } from "@/lib/types";

type Kind = Transfer["kind"];

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rândul de editat; gol înseamnă rând nou. */
  transfer: Transfer | null;
  /** Ziua curentă (AAAA-LL-ZZ), calculată pe server. */
  today: string;
  /**
   * Ziua propusă la rând nou: cel mai vechi gol rămas, altfel următorul
   * transfer. Ziua curentă aproape niciodată nu e zi de transfer.
   */
  proposedDate: string;
  isAdmin: boolean;
}

/**
 * Tipul potrivit pentru o zi: pe zilele programate „planificat", în rest
 * „urgent". Doar o propunere — se poate schimba, fiindcă un transfer programat
 * se poate muta pe altă zi și rămâne tot programat.
 */
function kindForDate(iso: string): Kind {
  return iso && isScheduled(parseISODate(iso)) ? "planificat" : "urgent";
}

export function TransferDialog({
  open,
  onOpenChange,
  transfer,
  today,
  proposedDate,
  isAdmin,
}: TransferDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [date, setDate] = useState(proposedDate);
  const [institution, setInstitution] = useState("");
  const [kind, setKind] = useState<Kind>("planificat");
  // Tipul ales de om nu se mai rescrie singur la schimbarea zilei.
  const [kindChosen, setKindChosen] = useState(false);
  // Cifrele stau ca text, ca să nu forțeze un 0 în câmpul golit.
  const [plecati, setPlecati] = useState("0");
  const [sositi, setSositi] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (transfer) {
      setDate(transfer.transfer_date);
      setInstitution(String(transfer.institution));
      setKind(transfer.kind);
      // Tipul salvat e o hotărâre luată deja: nu-l atinge nicio propunere.
      setKindChosen(true);
      setPlecati(String(transfer.plecati));
      setSositi(String(transfer.sositi));
      setNote(transfer.note ?? "");
    } else {
      setDate(proposedDate);
      setInstitution("");
      // Tipul urmează ziua propusă, nu ziua curentă: pe o zi programată
      // propunerea corectă e „planificat".
      setKind(kindForDate(proposedDate));
      setKindChosen(false);
      setPlecati("0");
      setSositi("0");
      setNote("");
    }
  }, [open, transfer, today, proposedDate]);

  const onDateChange = (value: string) => {
    setDate(value);
    if (!kindChosen) setKind(kindForDate(value));
  };

  const submit = () => {
    setError(null);
    const input = {
      transfer_date: date,
      institution,
      kind,
      plecati,
      sositi,
      note,
    };
    startTransition(async () => {
      const res = transfer
        ? await updateTransfer(transfer.id, input)
        : await createTransfer(input);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(transfer ? "Transfer salvat." : "Transfer înregistrat.");
      onOpenChange(false);
      router.refresh();
    });
  };

  const remove = () => {
    if (!transfer) return;
    if (!window.confirm("Ștergi rândul acesta din registru?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteTransfer(transfer.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Rând șters.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{transfer ? "Editează transferul" : "Transfer nou"}</DialogTitle>
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
              <Label htmlFor="t-date">Ziua</Label>
              <Input
                id="t-date"
                type="date"
                className="tabular-nums"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                required
              />
              {date && isScheduled(parseISODate(date)) && (
                <p className="text-xs text-muted-foreground">Zi de transfer programat.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tip</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  setKind(v as Kind);
                  setKindChosen(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planificat">Planificat</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Penitenciarul partener</Label>
            <Select value={institution} onValueChange={setInstitution}>
              <SelectTrigger>
                <SelectValue placeholder="Alege penitenciarul" />
              </SelectTrigger>
              <SelectContent>
                {INSTITUTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {institutionLabel(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="t-plecati">Plecați</Label>
              <Input
                id="t-plecati"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="tabular-nums"
                value={plecati}
                onChange={(e) => setPlecati(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-sositi">Sosiți</Label>
              <Input
                id="t-sositi"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="tabular-nums"
                value={sositi}
                onChange={(e) => setSositi(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-note">Observații</Label>
            <Textarea
              id="t-note"
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
              {/* Curtoazie în interfață: ștergerea o oprește oricum RLS. */}
              {transfer && isAdmin && (
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
                {transfer ? "Salvează" : "Înregistrează"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
