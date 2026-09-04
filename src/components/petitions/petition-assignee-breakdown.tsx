import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatar-color";
import { countsByAssignee, isPetitionOverdue } from "@/lib/hub-stats";
import { cn } from "@/lib/utils";
import type { Petition, Profile } from "@/lib/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function PetitionAssigneeBreakdown({
  petitions,
  profiles,
}: {
  petitions: Petition[];
  profiles: Profile[];
}) {
  // Doar petițiile în examinare — încărcarea curentă a fiecărui responsabil.
  const rows = countsByAssignee(
    petitions.filter((p) => p.status === "in_examinare"),
    profiles,
    (p) => isPetitionOverdue(p),
  );

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">Pe responsabil</h2>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nicio petiție în examinare.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li
              key={r.id ?? "none"}
              className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className={cn("text-xs", avatarColor(r.id ?? "none"))}>
                  {initials(r.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{r.name}</div>
                {r.overdue > 0 && (
                  <div className="text-xs tabular-nums text-red-600">{r.overdue} restante</div>
                )}
              </div>
              <span className="ml-auto shrink-0 text-sm tabular-nums text-muted-foreground">
                {r.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
