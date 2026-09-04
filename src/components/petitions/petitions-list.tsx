"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PetitionFiltersBar } from "@/components/petitions/petition-filters-bar";
import { PetitionFormDialog } from "./petition-form-dialog";
import { openAttachment } from "./open-attachment";
import { STATUS_LABEL, STATUS_DOT, PETITIONER_LABEL, daysUntil } from "./meta";
import { deletePetition, finalizePetition } from "@/app/petitii/actions";
import { avatarColor } from "@/lib/avatar-color";
import { canDeletePetition, canEditPetition } from "@/lib/permissions";
import { filterPetitions, type PetitionFilter } from "@/lib/petition-filters";
import { cn } from "@/lib/utils";
import type { Petition, PetitionStatus, Profile } from "@/lib/types";

function initials(name: string | null): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

// Marginea de urgență a rândului, echivalentul benzii de prioritate de la sarcini.
const URGENCY_BAR = {
  overdue: "bg-red-500",
  soon: "bg-amber-500",
  open: "bg-slate-300",
  solved: "bg-green-500",
} as const;

type UrgencyKey = keyof typeof URGENCY_BAR;

// Soluționat → verde; altfel termenul decide: trecut → restant,
// în următoarele 5 zile → scadent, restul → în examinare.
function urgencyOf(petition: Petition): { key: UrgencyKey; label: string } {
  if (petition.status === "solutionat") return { key: "solved", label: "Soluționat" };
  const d = daysUntil(petition.response_deadline);
  if (d !== null && d < 0) return { key: "overdue", label: "Restant" };
  if (d !== null && d <= 5) {
    const label = d === 0 ? "Scadent azi" : d === 1 ? "Scadent într-o zi" : `Scadent în ${d} zile`;
    return { key: "soon", label };
  }
  return { key: "open", label: "În examinare" };
}

// Ordinea de sortare a stărilor: În examinare → Soluționat.
const STATUS_ORDER: Record<PetitionStatus, number> = { in_examinare: 0, solutionat: 1 };

type SortKey = "number" | "deadline" | "status";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

function comparePetitions(a: Petition, b: Petition, key: SortKey, dir: "asc" | "desc"): number {
  const sign = dir === "asc" ? 1 : -1;
  if (key === "deadline") {
    const da = a.response_deadline;
    const db = b.response_deadline;
    // Fără termen → mereu la coadă, indiferent de direcție.
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return sign * da.localeCompare(db);
  }
  if (key === "status") {
    return sign * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }
  return sign * a.number.localeCompare(b.number, undefined, { numeric: true });
}

// Buton de sortare din antet: același aspect ca `HeaderSortButton` de la sarcini.
// `active` arată direcția curentă (săgeată plină); altfel iconița neutră.
function HeaderSortButton({
  label,
  onClick,
  active,
  className,
}: {
  label: string;
  onClick: () => void;
  active?: "asc" | "desc" | null;
  className?: string;
}) {
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      title={
        active
          ? `Sortat după ${label} (${active === "asc" ? "crescător" : "descrescător"})`
          : `Sortează după ${label}`
      }
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        active && "font-medium text-foreground",
        className,
      )}
    >
      {label}
      <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-60")} />
    </button>
  );
}

interface PetitionActionsMenuProps {
  petition: Petition;
  currentUserId: string | null;
  isAdmin: boolean;
  onEdit: (petition: Petition) => void;
  onDelete: (petition: Petition) => void;
  onFinalize: (petition: Petition) => void;
}

// Gating identic cu RLS din 0012_petitions.sql, prin helperii din @/lib/permissions.
function PetitionActionsMenu({
  petition,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
  onFinalize,
}: PetitionActionsMenuProps) {
  const uid = currentUserId ?? "";
  const canEdit = canEditPetition(uid, isAdmin, petition);
  const canDelete = canDeletePetition(uid, isAdmin, petition);
  // Finalizarea e tot o modificare — același drept ca editarea, dar doar cât
  // timp petiția nu e deja soluționată.
  const canFinalize = canEdit && petition.status !== "solutionat";
  if (!canEdit && !canDelete) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acțiuni</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canFinalize && (
          <DropdownMenuItem onSelect={() => onFinalize(petition)}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Finalizează
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem onSelect={() => onEdit(petition)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editează
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onDelete(petition)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Șterge
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Agrafa din listă: un singur fișier se deschide dintr-un click, mai multe
 * deschid un meniu. `stopPropagation` peste tot — altfel clickul ajunge la
 * rând și deschide dialogul petiției.
 */
function AttachmentBadge({ files }: { files: NonNullable<Petition["attachments"]> }) {
  if (files.length === 0) return null;

  const badge = (
    <>
      <Paperclip className="h-3.5 w-3.5" aria-hidden />
      {files.length}
    </>
  );
  const className =
    "flex shrink-0 items-center gap-0.5 rounded text-[11px] text-muted-foreground transition-colors hover:text-foreground";

  if (files.length === 1) {
    return (
      <button
        type="button"
        title={`Deschide „${files[0].name}"`}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          void openAttachment(files[0].path);
        }}
      >
        {badge}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button type="button" title={`${files.length} fișiere atașate`} className={className}>
          {badge}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {files.map((f) => (
          <DropdownMenuItem key={f.id} onSelect={() => void openAttachment(f.path)}>
            <Paperclip className="mr-2 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{f.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface PetitionsListProps {
  petitions: Petition[];
  profiles: Profile[];
  currentUserId: string | null;
  isAdmin: boolean;
  filter: PetitionFilter;
  onFilterChange: (f: PetitionFilter) => void;
  /** Petiția de deschis la sosire, din adresă — vine dintr-o notificare. */
  openPetitionId?: string;
}

export function PetitionsList({
  petitions,
  profiles,
  currentUserId,
  isAdmin,
  filter,
  onFilterChange,
  openPetitionId,
}: PetitionsListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Petition | undefined>(undefined);
  const [sort, setSort] = useState<SortState>(null);

  /*
   * Responsabilul se caută aici, nu vine încorporat în fiecare petiție.
   *
   * Așa venea până acum, și cântărea: pe datele din producție, profilul repetat
   * în cele 348 de rânduri făcea 67 din cei 320 KB ai paginii — deși profilurile
   * sunt patru cu totul. Lista lor se primește oricum, prin `profiles`.
   */
  const dupaId = useMemo(() => new Map(profiles.map((pr) => [pr.id, pr])), [profiles]);
  const responsabil = (id: string | null) => (id ? dupaId.get(id) ?? null : null);

  /*
   * Petiția din adresă se deschide o singură dată, la sosire.
   *
   * Se caută în `petitions`, lista întreagă, nu în rândurile filtrate: membrul
   * are registrul deschis implicit pe petițiile lui, iar adminul primește
   * notificări și despre ale altora. Căutată printre rândurile vizibile, exact
   * petiția pentru care a venit omul n-ar fi fost găsită.
   *
   * Parametrul se șterge din adresă imediat, prin `replaceState`: fără asta, o
   * reîncărcare a paginii ar redeschide fereastra peste registru, la nesfârșit.
   * `replaceState` și nu `router.replace` fiindcă nu vrem o nouă randare — doar
   * curățăm bara de adrese.
   */
  useEffect(() => {
    if (!openPetitionId) return;
    const p = petitions.find((x) => x.id === openPetitionId);
    if (p) {
      setEditing(p);
      setFormOpen(true);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("petitie");
    window.history.replaceState(null, "", url.toString());
    // Doar la sosire: dependența pe `petitions` ar redeschide fereastra la
    // fiecare reîmprospătare a listei după o salvare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPetitionId]);
  const [, startTransition] = useTransition();

  const rows = useMemo(() => {
    const filtered = filterPetitions(petitions, filter);
    // Ordinea implicită: nesoluționate primele, apoi după termen (cele mai apropiate sus).
    const base = [...filtered].sort((a, b) => {
      const solvedA = a.status === "solutionat" ? 1 : 0;
      const solvedB = b.status === "solutionat" ? 1 : 0;
      if (solvedA !== solvedB) return solvedA - solvedB;
      return (a.response_deadline ?? "9999-12-31").localeCompare(
        b.response_deadline ?? "9999-12-31",
      );
    });
    if (!sort) return base;
    // Sortarea explicită se aplică peste ordinea implicită; `Array.sort` fiind
    // stabil, egalitățile păstrează ordinea implicită drept criteriu secundar.
    return [...base].sort((a, b) => comparePetitions(a, b, sort.key, sort.dir));
  }, [petitions, filter, sort]);

  const filtersActive = Boolean(
    filter.search || filter.status || filter.assigneeId || filter.due,
  );

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev && prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  const openEdit = (p: Petition) => {
    setEditing(p);
    setFormOpen(true);
  };

  const handleDelete = (p: Petition) => {
    if (!window.confirm("Ștergi această petiție?")) return;
    startTransition(async () => {
      const result = await deletePetition(p.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Petiție ștearsă");
    });
  };

  const handleFinalize = (p: Petition) => {
    startTransition(async () => {
      const result = await finalizePetition(p.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Petiție soluționată");
    });
  };

  return (
    <div>
      <PetitionFiltersBar
        profiles={profiles}
        currentUserId={currentUserId}
        filter={filter}
        onFilterChange={onFilterChange}
        onNewPetition={() => {
          setEditing(undefined);
          setFormOpen(true);
        }}
      />

      {/*
        Plasa de siguranță: coloanele fixe fac 760px, iar „Obiect” are nevoie de
        vreo 140 ca să spună ceva — deci 900. Sub atât registrul se derulează
        lateral. E supărător, dar cinstit: fără asta conținutul dădea peste
        vecini, iar suprapunerea nu se vede ca o fereastră prea îngustă, se vede
        ca o aplicație stricată. Antetul are aceeași lățime minimă, deci
        derulează odată cu rândurile.
      */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        {/* Antet */}
        <div className="flex min-w-[900px] items-stretch border-b bg-muted/30">
          <span className="w-1 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2 text-[11px] font-medium text-muted-foreground">
            <HeaderSortButton
              label="Nr."
              onClick={() => toggleSort("number")}
              active={sort?.key === "number" ? sort.dir : null}
              className="w-28 shrink-0"
            />
            <span className="w-40 shrink-0">Petiționar</span>
            <span className="min-w-0 flex-1">Obiect</span>
            <span className="w-36 shrink-0">Responsabil</span>
            <HeaderSortButton
              label="Termen"
              onClick={() => toggleSort("deadline")}
              active={sort?.key === "deadline" ? sort.dir : null}
              className="w-24 shrink-0"
            />
            <HeaderSortButton
              label="Stare"
              onClick={() => toggleSort("status")}
              active={sort?.key === "status" ? sort.dir : null}
              className="w-28 shrink-0"
            />
            <span className="w-8 shrink-0" aria-hidden />
          </div>
        </div>

        {rows.length ? (
          <div className="min-w-[900px] divide-y">
            {rows.map((p) => {
              const urgency = urgencyOf(p);
              const overdue = urgency.key === "overdue";
              const soon = urgency.key === "soon";
              return (
                <div
                  key={p.id}
                  onClick={() => openEdit(p)}
                  className="flex cursor-pointer items-stretch transition-colors hover:bg-muted/50"
                >
                  <span
                    aria-label={urgency.label}
                    title={urgency.label}
                    className={cn("w-1 shrink-0", URGENCY_BAR[urgency.key])}
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2">
                    {/* Nr. + agrafa: deschide scanarea direct din listă */}
                    <div className="flex w-28 shrink-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-sm font-medium">{p.number}</span>
                      <AttachmentBadge files={p.attachments ?? []} />
                    </div>

                    {/* Petiționar */}
                    <div className="w-40 min-w-0 shrink-0">
                      <div className="truncate text-[13px]">{p.petitioner}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {PETITIONER_LABEL[p.petitioner_type]}
                      </div>
                    </div>

                    {/* Obiect */}
                    <div className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                      {p.subject || "—"}
                    </div>

                    {/* Responsabil */}
                    <div className="flex w-36 min-w-0 shrink-0 items-center gap-2">
                      {responsabil(p.assignee_id) ? (
                        <>
                          <Avatar className="h-6 w-6">
                            <AvatarFallback
                              className={cn(
                                "text-[10px]",
                                avatarColor(responsabil(p.assignee_id)!.id),
                              )}
                            >
                              {initials(responsabil(p.assignee_id)!.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-[13px]">
                            {responsabil(p.assignee_id)!.full_name ?? "—"}
                          </span>
                        </>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">Neatribuit</span>
                      )}
                    </div>

                    {/* Termen */}
                    <div className="w-24 shrink-0 text-[13px]">
                      {p.response_deadline ? (
                        <span
                          className={cn(
                            overdue && "font-medium text-red-600",
                            soon && "text-amber-600",
                          )}
                        >
                          {format(parseISO(p.response_deadline), "d MMM yyyy")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Stare */}
                    <div className="flex w-28 shrink-0 items-center gap-2">
                      <span
                        className={cn("h-2 w-2 rounded-full", STATUS_DOT[p.status])}
                        aria-hidden
                      />
                      <span className="text-[13px] text-muted-foreground">
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>

                    {/* Acțiuni */}
                    <div
                      className="flex w-8 shrink-0 justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PetitionActionsMenu
                        petition={p}
                        currentUserId={currentUserId}
                        isAdmin={isAdmin}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onFinalize={handleFinalize}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-muted-foreground">
            {filtersActive ? "Nicio petiție găsită." : "Nicio petiție înregistrată."}
          </div>
        )}
      </div>

      <PetitionFormDialog
        profiles={profiles}
        petition={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </div>
  );
}
