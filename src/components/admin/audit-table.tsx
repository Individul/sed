import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import {
  ArrowLeftRight,
  Scale,
  CalendarClock,
  DoorOpen,
  UserRound,
  Gavel,
  ListChecks,
  Mail,
  MessageSquare,
  Paperclip,
  Pencil,
  Tag as TagIcon,
  Users,
} from "lucide-react";

import { STATUS_LABEL as PETITION_STATUS_LABEL } from "@/components/petitions/meta";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/lib/types";

// Iconița spune din ce modul e intrarea, culoarea spune ce s-a întâmplat.
// Verbul e oricum scris în frază, deci culoarea nu poartă singură înțelesul.
const ACTION_META: Record<AuditEntry["action"], { verb: string; className: string }> = {
  INSERT: { verb: "a creat", className: "bg-emerald-50 text-emerald-600" },
  UPDATE: { verb: "a modificat", className: "bg-sky-50 text-sky-600" },
  DELETE: { verb: "a șters", className: "bg-red-50 text-red-600" },
};

const ENTITY_ICON: Record<AuditEntry["entity"], typeof Pencil> = {
  tasks: ListChecks,
  subtasks: ListChecks,
  comments: MessageSquare,
  tags: TagIcon,
  task_tags: TagIcon,
  petitions: Mail,
  petition_attachments: Paperclip,
  hearings: Gavel,
  transfers: ArrowLeftRight,
  transfer_plans: UserRound,
  obligations: CalendarClock,
  defendants: Scale,
  releases: DoorOpen,
  obligation_completions: CalendarClock,
  profiles: Users,
};

const ENTITY_LABEL: Record<AuditEntry["entity"], string> = {
  tasks: "sarcina",
  comments: "un comentariu la o sarcină",
  tags: "eticheta",
  task_tags: "o etichetă a unei sarcini",
  profiles: "utilizatorul",
  subtasks: "un pas",
  petitions: "petiția",
  petition_attachments: "un fișier al unei petiții",
  hearings: "evidența ședințelor",
  transfers: "evidența transferurilor",
  transfer_plans: "planificarea transferului",
  obligations: "informarea periodică",
  defendants: "inculpatul",
  releases: "evidența eliberărilor",
  obligation_completions: "un termen de informare",
};

/**
 * Eticheta unei stări de petiție venite din jurnal.
 *
 * Harta e cea din modulul de petiții, nu o copie locală: copia de aici nu
 * cunoștea decât stările de la data scrierii ei, iar `Record<string, string>`
 * lăsa compilatorul mut la orice stare nouă. Valoarea vine din JSON, deci
 * poate fi și o stare care nu mai există — aceea se arată cum e scrisă în
 * jurnal, nu se ascunde: istoria nu se rescrie.
 */
function petitionStatusLabel(v: unknown): string {
  const key = String(v);
  return key in PETITION_STATUS_LABEL
    ? PETITION_STATUS_LABEL[key as keyof typeof PETITION_STATUS_LABEL]
    : key;
}

function detailText(e: AuditEntry): string {
  const d = e.details ?? {};
  if (e.entity === "tasks" && d.title) return `„${String(d.title)}”`;
  if (e.entity === "tags" && d.name) return `„${String(d.name)}”`;
  if (e.entity === "profiles" && d.full_name) {
    const role = d.role ? ` (${String(d.role)})` : "";
    return `„${String(d.full_name)}”${role}`;
  }
  return "";
}

function phrase(e: AuditEntry): string {
  const verb = ACTION_META[e.action]?.verb ?? e.action;
  // Etichetele sunt deja create — pe o sarcină ele se adaugă/elimină, nu se „creează".
  if (e.entity === "task_tags") {
    if (e.action === "INSERT") return "a adăugat o etichetă la o sarcină";
    if (e.action === "DELETE") return "a eliminat o etichetă de la o sarcină";
    return `${verb} o etichetă a unei sarcini`;
  }
  if (e.entity === "subtasks") {
    const d = e.details ?? {};
    const title = d.title ? `„${String(d.title)}”` : "un pas";
    if (e.action === "INSERT") return `a adăugat pasul ${title}`;
    if (e.action === "DELETE") return `a șters pasul ${title}`;
    if (d.done_to === true) return `a bifat pasul ${title}`;
    if (d.done_to === false) return `a debifat pasul ${title}`;
    return `a modificat pasul ${title}`;
  }
  if (e.entity === "petitions") {
    const d = e.details ?? {};
    const nr = d.number ? `petiția ${String(d.number)}` : "o petiție";
    if (e.action === "INSERT") return `a înregistrat ${nr}`;
    if (e.action === "DELETE") return `a șters ${nr}`;
    // La modificare se scrie ce anume s-a schimbat; termenul legal atârnă de
    // data înregistrării, deci mutarea ei nu are voie să treacă neobservată.
    if (d.received_from && d.received_to) {
      return `a mutat data înregistrării la ${nr}: ${String(d.received_from)} → ${String(d.received_to)}`;
    }
    if (d.status_to) {
      return `a trecut ${nr} în „${petitionStatusLabel(d.status_to)}”`;
    }
    if (d.assignee_to) return `a atribuit ${nr} lui ${String(d.assignee_to)}`;
    if (d.assignee_from) return `a scos responsabilul de la ${nr}`;
    if (d.number_from && d.number_to) {
      return `a schimbat numărul petiției: ${String(d.number_from)} → ${String(d.number_to)}`;
    }
    return `a modificat ${nr}`;
  }
  if (e.entity === "petition_attachments") {
    const d = e.details ?? {};
    const la = d.number ? ` la petiția ${String(d.number)}` : " la o petiție";
    const nume = d.name ? `„${String(d.name)}”` : "un fișier";
    if (e.action === "INSERT") return `a atașat ${nume}${la}`;
    if (e.action === "DELETE") return `a șters fișierul ${nume}${la}`;
    return `a modificat fișierul ${nume}${la}`;
  }
  if (e.entity === "transfer_plans") {
    const d = e.details ?? {};
    const cine = d.name ? String(d.name) : "o persoană";
    if (e.action === "INSERT") return `a pus ${cine} pe lista de transfer`;
    if (e.action === "DELETE") return `a scos ${cine} de pe lista de transfer`;
    // Amânarea e motivul principal al modulului: mutarea datei trebuie scrisă.
    if (d.hearing_from && d.hearing_to) {
      return `a mutat ședința lui ${cine}: ${String(d.hearing_from)} → ${String(d.hearing_to)}`;
    }
    if (d.done_to === true) return `a încheiat transferul lui ${cine}`;
    if (d.done_to === false) return `a redeschis transferul lui ${cine}`;
    return `a modificat însemnarea lui ${cine}`;
  }
  if (e.entity === "obligation_completions") {
    const d = e.details ?? {};
    const ce = d.title ? `„${String(d.title)}”` : "o informare";
    const cand = d.due_date ? ` (termen ${String(d.due_date)})` : "";
    if (e.action === "INSERT") return `a bifat ${ce}${cand} ca expediată`;
    if (e.action === "DELETE") return `a scos bifa de la ${ce}${cand}`;
    return `a modificat bifa la ${ce}${cand}`;
  }
  if (e.entity === "defendants") {
    const d = e.details ?? {};
    const cine = d.name ? String(d.name) : "un inculpat";
    if (e.action === "INSERT") return `a înscris ${cine} în registrul inculpaților`;
    if (e.action === "DELETE") return `a șters ${cine} din registrul inculpaților`;
    if (d.status_to === "condamnat") return `a trecut ${cine} la condamnat`;
    if (d.status_to === "inculpat") return `a readus ${cine} în lista de inculpați`;
    // Tipul nu se schimbă prin regulă, deci o schimbare e fie corectare, fie greșeală.
    if (d.regime_from && d.regime_to) {
      return `a schimbat tipul de penitenciar la ${cine}: ${String(d.regime_from)} → ${String(d.regime_to)}`;
    }
    return `a modificat însemnarea lui ${cine}`;
  }
  if (e.entity === "hearings") {
    const d = e.details ?? {};
    const zi = d.session_date
      ? format(parseISO(String(d.session_date)), "d MMM yyyy", { locale: ro })
      : "o zi";
    if (e.action === "INSERT") return `a introdus ședințele din ${zi}`;
    if (e.action === "DELETE") return `a șters ședințele din ${zi}`;
    // La corectare, cifra e tot ce contează: altfel nu se vede ce s-a schimbat.
    if (d.total_from !== undefined && d.total_to !== undefined) {
      return `a corectat ședințele din ${zi}: total ${String(d.total_from)} → ${String(d.total_to)}`;
    }
    return `a modificat ședințele din ${zi}`;
  }
  if (e.entity === "releases") {
    const d = e.details ?? {};
    const zi = d.release_date
      ? format(parseISO(String(d.release_date)), "d MMM yyyy", { locale: ro })
      : "o zi";
    if (e.action === "INSERT") return `a introdus eliberările din ${zi}`;
    if (e.action === "DELETE") return `a șters eliberările din ${zi}`;
    // Cifra e tot ce are rândul: după ce numărul vechi a fost suprascris, doar
    // „3 → 5" mai spune dacă a fost o corectură sau o greșeală.
    if (d.count_from !== undefined && d.count_to !== undefined) {
      return `a corectat eliberările din ${zi}: ${String(d.count_from)} → ${String(d.count_to)}`;
    }
    return `a modificat eliberările din ${zi}`;
  }
  const label = ENTITY_LABEL[e.entity] ?? e.entity;
  const detail = detailText(e);
  return `${verb} ${label}${detail ? ` ${detail}` : ""}`;
}

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nicio activitate înregistrată încă.</p>;
  }

  // Grupare pe zile (intrările vin deja sortate descrescător după dată).
  const groups: { key: string; label: string; items: AuditEntry[] }[] = [];
  for (const e of entries) {
    const key = format(parseISO(e.created_at), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      groups.push({
        key,
        label: format(parseISO(e.created_at), "d MMMM yyyy", { locale: ro }),
        items: [e],
      });
    } else {
      last.items.push(e);
    }
  }

  return (
    <div className="max-h-[520px] space-y-6 overflow-auto rounded-lg border p-4">
      {groups.map((g) => (
        <div key={g.key} className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {g.label}
          </h3>
          <ul className="space-y-3">
            {g.items.map((e) => {
              const meta = ACTION_META[e.action];
              const Icon = ENTITY_ICON[e.entity] ?? Pencil;
              return (
                <li key={e.id} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      meta?.className ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{e.actor_name ?? "Sistem"}</span>{" "}
                      {phrase(e)}
                    </p>
                    <p
                      className="mt-0.5 text-xs text-muted-foreground"
                      title={format(parseISO(e.created_at), "d MMM yyyy, HH:mm")}
                    >
                      {formatDistanceToNow(parseISO(e.created_at), {
                        addSuffix: true,
                        locale: ro,
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
