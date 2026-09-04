"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPetition,
  updatePetition,
  deletePetition,
  type PetitionInput,
} from "@/app/petitii/actions";
import { PetitionAttachments } from "./petition-attachments";
import { PETITIONER_OPTIONS, STATUS_OPTIONS, deadlineFrom } from "./meta";
import { autoAssignee } from "@/lib/auto-assignee";
import { canEditPetition, canDeletePetition, canReassignPetition } from "@/lib/permissions";
import {
  SUBJECT_PRESETS,
  hasSubjectPreset,
  toggleSubjectPreset,
} from "@/lib/petition-subjects";
import { cn } from "@/lib/utils";
import type { Petition, Profile, PetitionStatus, PetitionerType } from "@/lib/types";

const UNASSIGNED = "unassigned";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface PetitionFormDialogProps {
  profiles: Profile[];
  petition?: Petition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string | null;
  isAdmin: boolean;
}

export function PetitionFormDialog({
  profiles,
  petition,
  open,
  onOpenChange,
  currentUserId,
  isAdmin,
}: PetitionFormDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [numberField, setNumberField] = useState("");
  const [petitioner, setPetitioner] = useState("");
  const [petitionerType, setPetitionerType] = useState<PetitionerType>("detinut");
  const [subject, setSubject] = useState("");
  const [receivedDate, setReceivedDate] = useState(today());
  const [assigneeId, setAssigneeId] = useState("");
  // Odată ce responsabilul a fost ales cu mâna, regula literelor tace. Altfel o
  // corectare a numelui de după — o literă în plus la tastat — ar muta petiția
  // înapoi, peste hotărârea omului.
  const [assigneeAles, setAssigneeAles] = useState(false);
  const [status, setStatus] = useState<PetitionStatus>("in_examinare");
  const [response, setResponse] = useState("");
  const [responseDate, setResponseDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Petiția tocmai creată în acest dialog: o ține deschis, în modul editare,
  // ca fișierele să poată fi atașate imediat (atașamentele au nevoie de id).
  const [created, setCreated] = useState<{ id: string; number: string } | null>(null);
  const filesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCreated(null);
    if (petition) {
      setNumberField(petition.number);
      setPetitioner(petition.petitioner);
      setPetitionerType(petition.petitioner_type);
      setSubject(petition.subject ?? "");
      setReceivedDate(petition.received_date);
      setAssigneeId(petition.assignee_id ?? "");
      setStatus(petition.status);
      setResponse(petition.response ?? "");
      setResponseDate(petition.response_date ?? "");
    } else {
      setNumberField("");
      setPetitioner("");
      setPetitionerType("detinut");
      setSubject("");
      setReceivedDate(today());
      setAssigneeId("");
      setStatus("in_examinare");
      setResponse("");
      setResponseDate("");
    }
    // La fiecare deschidere se pornește de la zero: o alegere manuală dintr-o
    // petiție de acum zece minute n-are ce căuta în următoarea.
    setAssigneeAles(Boolean(petition));
  }, [open, petition]);

  /*
   * Responsabilul se completează singur, după litera numelui petiționarului.
   *
   * Doar la petiții noi și doar când le înregistrează administratorul — așa a
   * fost cerută. Nu e o îngrădire tehnică: politica de inserare din bază
   * verifică cine creează, nu cui i se atribuie, deci ea ar primi și o petiție
   * pe care o colegă o trece pe numele celeilalte. E doar hotărârea de a lăsa
   * deocamdată regula acolo unde se face cea mai mare parte a înregistrărilor.
   *
   * Se face aici, în formular, și nu la salvare: omul vede cui îi revine
   * înainte să apese, iar dacă nu-i convine schimbă pe loc. O atribuire făcută
   * tăcut pe server s-ar descoperi abia din lista de petiții.
   *
   * `null` (literă neacoperită, nume încă gol) golește câmpul în loc să-l lase
   * pe cel dinainte — altfel, ștergând numele, ar rămâne agățat responsabilul
   * calculat pentru un nume care nu mai există.
   */
  useEffect(() => {
    if (petition || !isAdmin || assigneeAles) return;
    setAssigneeId(autoAssignee(petitioner, profiles) ?? "");
  }, [petitioner, petition, isAdmin, assigneeAles, profiles]);

  // După înregistrare, aducem secțiunea de fișiere în dreptul ochilor.
  useEffect(() => {
    if (created) filesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [created]);

  // Petiția pe care lucrează dialogul: cea deschisă din listă sau cea creată acum.
  const activeId = petition?.id ?? created?.id ?? null;
  const activeNumber = petition?.number ?? created?.number ?? "";
  const isEdit = Boolean(activeId);

  // O singură sursă de adevăr pentru drepturi (aceleași reguli ca RLS și ca meniul din listă).
  const uid = currentUserId ?? "";
  // Pe cea tocmai creată drepturile sunt implicite: utilizatorul curent e autorul.
  const canDelete = petition ? canDeletePetition(uid, isAdmin, petition) : Boolean(created);
  // La creare oricine poate scrie; la editare doar cine are dreptul — altfel doar vizualizare.
  const readOnly = !!petition && !canEditPetition(uid, isAdmin, petition);
  // La creare responsabilul se alege liber: creatorul e utilizatorul curent.
  const canReassign = !petition || canReassignPetition(uid, isAdmin, petition);
  const deadline = deadlineFrom(receivedDate);
  const yy = (receivedDate || today()).slice(2, 4);

  const buildInput = (): PetitionInput => ({
    petitioner,
    petitioner_type: petitionerType,
    subject,
    received_date: receivedDate,
    assignee_id: assigneeId,
    status,
    response,
    response_date: responseDate,
  });

  const submit = () => {
    setError(null);
    startTransition(async () => {
      if (activeId) {
        const res = await updatePetition(activeId, numberField, buildInput());
        if (res.error) {
          setError(res.error);
          return;
        }
        toast.success("Petiție salvată.");
        onOpenChange(false);
        router.refresh();
        return;
      }

      const res = await createPetition(numberField, buildInput());
      if (res.error) {
        setError(res.error);
        return;
      }
      if (!res.id || !res.number) {
        // Rândul e scris, dar fără id nu putem atașa nimic aici.
        toast.success("Petiție înregistrată.");
        onOpenChange(false);
        router.refresh();
        return;
      }
      // Nu închidem: petiția există acum, deci se pot atașa fișierele pe loc.
      setCreated({ id: res.id, number: res.number });
      setNumberField(res.number);
      toast.success("Petiție înregistrată. Atașează scanarea.");
      router.refresh();
    });
  };

  const remove = () => {
    if (!activeId) return;
    if (!window.confirm("Ștergi această petiție?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePetition(activeId);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Petiție ștearsă.");
      onOpenChange(false);
      router.refresh();
    });
  };

  // La marcarea „Soluționat" prefill data răspunsului cu ziua curentă, dacă lipsește.
  const onStatusChange = (v: PetitionStatus) => {
    setStatus(v);
    if (v === "solutionat" && !responseDate) setResponseDate(today());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Secțiunea de fișiere alungește dialogul — îl lăsăm să deruleze, ca footerul să rămână accesibil. */}
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? "Petiția"
              : created
                ? "Atașează fișierele"
                : isEdit
                  ? "Editează petiția"
                  : "Petiție nouă"}
          </DialogTitle>
          {created && (
            <p className="text-sm text-muted-foreground">
              Petiția {created.number} a fost înregistrată. Atașează scanarea mai jos, apoi
              închide.
            </p>
          )}
          {readOnly && (
            <p className="text-sm text-muted-foreground">
              Doar vizualizare — nu ai drept de editare pentru această petiție.
            </p>
          )}
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
              <Label htmlFor="p-number">Nr. de înregistrare</Label>
              <Input
                id="p-number"
                value={numberField}
                onChange={(e) => setNumberField(e.target.value)}
                disabled={readOnly}
                placeholder={isEdit ? "M-535/26" : "M-535"}
                required
              />
              {!isEdit && (
                <p className="text-xs text-muted-foreground">/{yy} se adaugă automat.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-received">Data înregistrării</Label>
              <Input
                id="p-received"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                disabled={readOnly}
                required
              />
              {deadline && (
                <p className="text-xs text-muted-foreground">
                  Termen (27 zile): {format(deadline, "d MMM yyyy")}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="p-petitioner">Petiționar</Label>
              <Input
                id="p-petitioner"
                value={petitioner}
                onChange={(e) => setPetitioner(e.target.value)}
                disabled={readOnly}
                placeholder="Nume, prenume"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tip petiționar</Label>
              <Select disabled={readOnly}
                value={petitionerType}
                onValueChange={(v) => setPetitionerType(v as PetitionerType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PETITIONER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-subject">Obiect</Label>
            <Textarea
              id="p-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={readOnly}
              placeholder="Obiectul petiției (opțional)"
            />
            {!readOnly && (
              <div className="flex flex-wrap gap-1.5">
                {SUBJECT_PRESETS.map((preset) => {
                  const active = hasSubjectPreset(subject, preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={active}
                      // Se pot alege mai multe; reapăsat, scoate doar bucata lui.
                      onClick={() => setSubject(toggleSubjectPreset(subject, preset))}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs transition-colors",
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Responsabil</Label>
              {/* Poarta urmează exact WITH CHECK-ul din bază: responsabilul
                  care nu e creator ar fi refuzat de RLS cu o eroare Postgres
                  în engleză. Mai bine un selector blocat decât o promisiune
                  pe care baza o retează la salvare. */}
              <Select disabled={readOnly || !canReassign}
                value={assigneeId ? assigneeId : UNASSIGNED}
                onValueChange={(v) => {
                  setAssigneeId(v === UNASSIGNED ? "" : v);
                  setAssigneeAles(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Neatribuit</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? "(fără nume)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stare</Label>
              <Select disabled={readOnly} value={status} onValueChange={(v) => onStatusChange(v as PetitionStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="p-response-date">Data răspunsului</Label>
              <Input
                id="p-response-date"
                type="date"
                value={responseDate}
                onChange={(e) => setResponseDate(e.target.value)}
              disabled={readOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-response">Răspuns</Label>
            <Textarea
              id="p-response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              disabled={readOnly}
              placeholder="Conținutul răspunsului (opțional)"
            />
          </div>

          <div ref={filesRef} className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">Fișiere</h3>
            {activeId ? (
              <PetitionAttachments
                petitionId={activeId}
                petitionNumber={activeNumber}
                petitioner={petition?.petitioner ?? petitioner}
                canEdit={!readOnly}
              />
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Salvează petiția, apoi atașează fișierele.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {canDelete && (
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
                {readOnly || created ? "Închide" : "Anulează"}
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={isPending}>
                  {isEdit ? "Salvează" : "Înregistrează"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
