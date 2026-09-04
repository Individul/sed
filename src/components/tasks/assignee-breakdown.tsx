import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";
import type { Profile, Task } from "@/lib/types";

interface Row {
  id: string;
  name: string;
  open: number;
  done: number;
  total: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AssigneeBreakdown({ tasks, profiles }: { tasks: Task[]; profiles: Profile[] }) {
  const rows: Row[] = profiles
    .map((p) => {
      const own = tasks.filter((t) => t.assignee_id === p.id);
      const done = own.filter((t) => t.status === "done").length;
      return {
        id: p.id,
        name: p.full_name ?? "(fără nume)",
        open: own.length - done,
        done,
        total: own.length,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const unassigned = tasks.filter((t) => !t.assignee_id).length;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">Pe responsabil</h2>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nicio sarcină atribuită.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
              <Avatar className="h-6 w-6">
                <AvatarFallback className={cn("text-xs", avatarColor(r.id))}>
                  {initials(r.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{r.name}</div>
                <div className="text-xs tabular-nums text-muted-foreground">
                  {r.open} deschise · {r.done} gata
                </div>
              </div>
              <span className="ml-auto shrink-0 text-sm tabular-nums text-muted-foreground">
                {r.total}
              </span>
            </li>
          ))}
        </ul>
      )}

      {unassigned > 0 && (
        <p className="text-xs text-muted-foreground">Neatribuite: {unassigned}</p>
      )}
    </div>
  );
}
