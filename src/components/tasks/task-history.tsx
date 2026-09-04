import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { CheckCircle2, Circle, Clock, Pencil, Plus, X } from "lucide-react";

// Hărțile vin din `meta`, tipizate pe uniuni, nu copii locale pe `string`.
// Copia de stări de aici nu cunoștea „în așteptare" și compilatorul a tăcut;
// prioritățile aveau exact aceeași structură și așteptau același accident.
import { PRIORITY_LABEL, STATUS_LABEL } from "@/components/tasks/meta";
import { cn } from "@/lib/utils";
import type { AuditEntry, TaskPriority, TaskStatus } from "@/lib/types";

const TONE: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-600",
  blue: "bg-sky-50 text-sky-600",
  red: "bg-red-50 text-red-600",
  gray: "bg-muted text-muted-foreground",
};

function fmtDue(v: unknown): string {
  if (!v) return "fără termen";
  try {
    return format(parseISO(String(v)), "d MMM yyyy");
  } catch {
    return String(v);
  }
}

/**
 * Eticheta unei stări venite din jurnal.
 *
 * Valoarea vine din JSON-ul auditului, deci e `string`, nu `TaskStatus` — și
 * chiar poate fi o stare care nu mai există în cod, fiindcă jurnalul păstrează
 * și trecutul. De aceea căutarea e totală: necunoscutul se arată așa cum e
 * scris în jurnal, nu ca „—". O liniuță ar șterge din istorie exact informația
 * pentru care există istoria.
 */
function statusLabel(v: unknown): string {
  const key = String(v);
  return key in STATUS_LABEL ? STATUS_LABEL[key as TaskStatus] : key;
}

/** Aceeași regulă ca la stări: necunoscutul se arată cum e scris în jurnal. */
function priorityLabel(v: unknown): string {
  const key = String(v);
  return key in PRIORITY_LABEL ? PRIORITY_LABEL[key as TaskPriority] : key;
}

function changeLines(e: AuditEntry): string[] {
  const d = e.details ?? {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(d, k);
  const out: string[] = [];
  if (has("status_to")) {
    out.push(
      `Stare: ${statusLabel(d.status_from)} → ${statusLabel(d.status_to)}`,
    );
  }
  if (has("priority_to")) {
    out.push(
      `Prioritate: ${priorityLabel(d.priority_from)} → ${priorityLabel(d.priority_to)}`,
    );
  }
  if (has("assignee_to")) {
    out.push(
      `Responsabil: ${d.assignee_from ? String(d.assignee_from) : "Neatribuit"} → ${d.assignee_to ? String(d.assignee_to) : "Neatribuit"}`,
    );
  }
  if (has("due_to")) out.push(`Termen: ${fmtDue(d.due_from)} → ${fmtDue(d.due_to)}`);
  if (has("title_to")) out.push("Titlu modificat");
  return out;
}

function describe(e: AuditEntry): {
  Icon: typeof Plus;
  tone: string;
  text: string;
  changes: string[];
} {
  if (e.entity === "subtasks") {
    const d = e.details ?? {};
    const title = d.title ? `„${String(d.title)}”` : "un pas";
    if (e.action === "INSERT") return { Icon: Plus, tone: "gray", text: `a adăugat pasul ${title}`, changes: [] };
    if (e.action === "DELETE") return { Icon: X, tone: "red", text: `a șters pasul ${title}`, changes: [] };
    if (d.done_to === true)
      return { Icon: CheckCircle2, tone: "green", text: `a bifat pasul ${title}`, changes: [] };
    if (d.done_to === false)
      return { Icon: Circle, tone: "gray", text: `a debifat pasul ${title}`, changes: [] };
    return { Icon: Pencil, tone: "blue", text: `a modificat pasul ${title}`, changes: [] };
  }
  if (e.action === "INSERT") return { Icon: Plus, tone: "green", text: "a creat sarcina", changes: [] };
  return { Icon: Pencil, tone: "blue", text: "a modificat sarcina", changes: changeLines(e) };
}

export function TaskHistory({ entries }: { entries: AuditEntry[] }) {
  if (!entries || entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Istoric
      </h2>
      <ul className="space-y-3">
        {entries.map((e) => {
          const info = describe(e);
          const Icon = info.Icon;
          return (
            <li key={e.id} className="flex gap-3 text-sm">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  TONE[info.tone],
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-medium">{e.actor_name ?? "Sistem"}</span> {info.text}
                </p>
                {info.changes.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                    {info.changes.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                )}
                <p
                  className="mt-0.5 text-xs text-muted-foreground"
                  title={format(parseISO(e.created_at), "d MMM yyyy, HH:mm")}
                >
                  {format(parseISO(e.created_at), "d MMM yyyy, HH:mm", { locale: ro })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
