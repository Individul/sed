"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, isValid, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  previewImport,
  reportExists,
  saveImport,
  type StatPreview,
} from "@/app/statistici/actions";
import type { PeriodType } from "@/lib/stats/period";
import { hasBothSeries } from "@/lib/stats/series";
import type { StatKind } from "@/lib/stats/types";
import {
  KIND_OPTIONS,
  PERIOD_TYPE_LABEL,
  SERIES_LABEL,
  kindLabel,
} from "@/lib/stats/labels";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS: PeriodType[] = ["lunar", "saptamanal"];

/** Fișierul în base64, așa cum îl așteaptă `saveImport` (prefixul `data:` e acceptat). */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Nu am putut citi fișierul de pe disc."));
    reader.readAsDataURL(file);
  });
}

/**
 * Perioada scrisă ca între oameni: „30 iunie 2026", nu „2026-06-30". `null` cât
 * timp câmpul e gol sau ține o dată neterminată — propoziția de confirmare tace
 * atunci despre perioadă, iar nota de sub calendar spune ce lipsește.
 */
function formatPeriod(iso: string): string | null {
  if (!iso) return null;
  const parsed = parseISO(iso);
  return isValid(parsed) ? format(parsed, "d MMMM yyyy", { locale: ro }) : null;
}

/**
 * „Vezi cele 27 de valori extrase". Româna cere „de" când ultimele două cifre
 * trec de 20, iar o singură valoare nu se numără deloc.
 */
function extractedSummary(count: number): string {
  if (count === 1) return "Vezi valoarea extrasă";
  const lastTwo = count % 100;
  const de = lastTwo === 0 || lastTwo >= 20 ? " de" : "";
  return `Vezi cele ${count}${de} valori extrase`;
}

export function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Fișierul ales rămâne în stare: previzualizarea l-a citit pe server, dar
  // salvarea are nevoie de octeții lui ca să urce sursa.
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StatPreview | null>(null);
  /**
   * Tipul sub care se salvează. E mereu tipul parserului care a produs
   * indicatorii de pe ecran: se schimbă doar odată cu o recitire reușită, iar
   * o recitire eșuată îl dă înapoi.
   */
  const [kind, setKind] = useState<StatKind | null>(null);
  const [periodDate, setPeriodDate] = useState("");
  const [periodType, setPeriodType] = useState<PeriodType>("lunar");
  // Ținut separat de `preview.existing`: perioada se poate schimba din mână,
  // iar avertismentul trebuie să spună adevărul despre perioada de acum.
  const [existing, setExisting] = useState(false);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setKind(null);
    setPeriodDate("");
    setPeriodType("lunar");
    setExisting(false);
    setPending(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  /*
   * Avertismentul de înlocuire, recalculat ori de câte ori se schimbă tipul sau
   * perioada. Serverul îl trimite o dată, pentru perioada ghicită din numele
   * fișierului; de acolo încolo doar interfața știe ce a ales omul.
   */
  useEffect(() => {
    if (!kind || !periodDate) {
      setExisting(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const found = await reportExists(kind, periodDate, periodType);
        if (active) setExisting(found);
      } catch {
        // Fără avertisment e mai bine decât cu unul greșit; `saveImport`
        // înlocuiește oricum corect.
        if (active) setExisting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [kind, periodDate, periodType]);

  const handleOpenChange = (next: boolean) => {
    // Cât timp rulează o operațiune, dialogul nu se închide sub mâna omului.
    if (pending) return;
    setOpen(next);
    if (!next) reset();
  };

  const handlePick = async (input: HTMLInputElement) => {
    const picked = input.files?.[0];
    // Resetăm imediat, ca același fișier să poată fi ales din nou după o eroare.
    input.value = "";
    if (!picked) return;

    setPending(true);
    setPreview(null);
    setKind(null);
    setFile(picked);
    try {
      const data = new FormData();
      data.append("file", picked);
      const res = await previewImport(data);
      // Uniune discriminată: eroarea și raportul citit nu se pot confunda.
      if ("error" in res) {
        toast.error(res.error);
        setFile(null);
        return;
      }
      setPreview(res);
      setKind(res.kind);
      setExisting(res.existing);
      setPeriodDate(res.suggested?.date ?? "");
      setPeriodType(res.suggested?.type ?? "lunar");
    } catch {
      toast.error("Nu am putut citi fișierul.");
      setFile(null);
    } finally {
      setPending(false);
    }
  };

  /**
   * Alt tip decât cel recunoscut: fișierul se recitește pe loc, cu parserul
   * cerut. Indicatorii de pe ecran rămân astfel mereu ai tipului sub care se
   * salvează — obiecția care ținea selectorul blocat. Perioada aleasă de om nu
   * se atinge; o recitire eșuată lasă totul cum era.
   */
  const handleKindChange = async (next: StatKind) => {
    if (!file || next === kind) return;
    const previous = kind;
    setKind(next); // răspuns imediat în selector, cât ține recitirea
    setPending(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("kind", next);
      const res = await previewImport(data);
      if ("error" in res) {
        // Mesajul e chiar al parserului cerut („nu găsesc coloana P-6"…), adică
        // exact motivul pentru care fișierul nu e de tipul ales.
        toast.error(res.error);
        setKind(previous);
        return;
      }
      setPreview(res);
    } catch {
      toast.error("Nu am putut reciti fișierul.");
      setKind(previous);
    } finally {
      setPending(false);
    }
  };

  const handleSave = async () => {
    if (!preview || !file || !kind || !periodDate) return;
    setPending(true);
    try {
      const fileBase64 = await readAsBase64(file);
      const res = await saveImport({
        // Egal cu `preview.kind` prin construcție: indicatorii de mai jos vin
        // de la parserul acestui tip, fiindcă orice schimbare i-a recitit.
        kind,
        periodDate,
        periodType,
        fileName: preview.fileName,
        fileBase64,
        items: preview.items,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Raport importat");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Importul a eșuat.");
    } finally {
      setPending(false);
    }
  };

  // Perioada scrisă omenește, pentru propoziția de confirmare; `null` cât timp
  // calendarul e gol.
  const periodLabel = formatPeriod(periodDate);
  /*
   * Coloana care explică seria are rost doar unde chiar sunt două serii de
   * deosebit — la șase rapoarte din opt totul e „cumulat" fiindcă parserul n-are
   * cu ce altceva să marcheze valorile.
   */
  const showSeries = preview !== null && hasBothSeries(preview.items);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" aria-hidden />
        Importă raport
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importă raport</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="stat-file">Fișier .xlsx</Label>
              <Input
                id="stat-file"
                ref={inputRef}
                type="file"
                accept=".xlsx"
                disabled={pending}
                className="cursor-pointer file:mr-3 file:cursor-pointer file:text-foreground"
                onChange={(e) => {
                  void handlePick(e.currentTarget);
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Tipul raportului se recunoaște singur din conținutul fișierului; dacă nimerește
                greșit, îl poți schimba mai jos.
              </p>
            </div>

            {pending && !preview && (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Se citește fișierul…
              </p>
            )}

            {preview && (
              <div className="space-y-4">
                {/*
                 * Confirmarea, într-o singură propoziție: ce raport am înțeles
                 * că e și pe ce perioadă. Verbul spune și de unde vine tipul —
                 * „am recunoscut" când l-a găsit programul, „ai ales" când l-a
                 * pus omul din selectorul de dedesubt. Cât ține o recitire,
                 * selectorul arată deja tipul cel nou, iar `preview` încă e al
                 * celui vechi: comparația dintre ele ține propoziția sinceră.
                 */}
                <p className="text-[13px] leading-relaxed">
                  {preview.forced || kind !== preview.kind ? "Ai ales:" : "Am recunoscut:"}{" "}
                  <span className="font-medium text-foreground">
                    {kindLabel(kind ?? preview.kind)}
                  </span>
                  {periodLabel && (
                    <>
                      , perioada{" "}
                      <span className="font-medium text-foreground">{periodLabel}</span>
                    </>
                  )}
                  . E corect?
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/*
                   * Schimbarea tipului recitește fișierul cu parserul cerut, deci
                   * ce se vede pe ecran e mereu al tipului sub care se salvează.
                   */}
                  <div className="space-y-1.5">
                    <Label htmlFor="stat-kind">Tip raport</Label>
                    <Select
                      value={kind ?? undefined}
                      disabled={pending}
                      onValueChange={(value) => {
                        // Îngustare prin lista de opțiuni, nu conversie forțată.
                        const option = KIND_OPTIONS.find((o) => o.kind === value);
                        if (option) void handleKindChange(option.kind);
                      }}
                    >
                      <SelectTrigger id="stat-kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KIND_OPTIONS.map((o) => (
                          <SelectItem key={o.kind} value={o.kind}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="stat-period-type">Tip perioadă</Label>
                    <Select
                      value={periodType}
                      onValueChange={(v) => setPeriodType(v as PeriodType)}
                      disabled={pending}
                    >
                      <SelectTrigger id="stat-period-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIOD_OPTIONS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {PERIOD_TYPE_LABEL[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="stat-period-date">Perioada</Label>
                    <Input
                      id="stat-period-date"
                      type="date"
                      value={periodDate}
                      disabled={pending}
                      onChange={(e) => setPeriodDate(e.target.value)}
                    />
                    {!periodDate && (
                      <p className="text-[11px] text-muted-foreground">
                        Nu am ghicit perioada din numele fișierului — alege-o.
                      </p>
                    )}
                  </div>
                </div>

                {existing && (
                  <p className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-[13px] text-yellow-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    Există deja un raport pentru această perioadă — va fi înlocuit.
                  </p>
                )}

                {/*
                 * Cifrele citite din fișier, strânse: cine importă un raport se
                 * uită la ce scrie mai sus, nu la treizeci de rânduri de Excel.
                 * Stau totuși la un click distanță, ca importul să poată fi
                 * verificat înainte de salvare. Cât ține o recitire, lista veche
                 * rămâne pe ecran, estompată.
                 */}
                <details className="overflow-hidden rounded-xl border bg-card">
                  <summary className="cursor-pointer px-3.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50">
                    {pending ? "Se recitesc valorile…" : extractedSummary(preview.items.length)}
                  </summary>
                  <div
                    className={cn(
                      "max-h-64 overflow-auto border-t",
                      pending && "opacity-60",
                    )}
                  >
                    <table className="w-full text-[13px]">
                      <thead className="sticky top-0 bg-muted/30 text-[11px] font-medium text-muted-foreground">
                        <tr>
                          <th className="px-3.5 py-2 text-left font-medium">Indicator</th>
                          {showSeries && (
                            <th className="w-52 px-3 py-2 text-left font-medium">Se referă la</th>
                          )}
                          <th className="w-28 px-3.5 py-2 text-right font-medium">Valoare</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {preview.items.map((item, i) => (
                          <tr key={`${item.series}-${item.indicator}-${i}`}>
                            <td className="px-3.5 py-1.5">{item.indicator}</td>
                            {showSeries && (
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {SERIES_LABEL[item.series]}
                              </td>
                            )}
                            <td className="px-3.5 py-1.5 text-right tabular-nums">
                              {item.value === null ? "—" : item.value.toLocaleString("ro-RO")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
            >
              Renunță
            </Button>
            <Button
              type="button"
              disabled={pending || !preview || !periodDate}
              onClick={() => {
                void handleSave();
              }}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Importă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
