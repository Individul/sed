import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";

export interface ModuleCardStat {
  label: string;
  /** Explicația completă, la hover, când eticheta e prescurtată. */
  title?: string;
  /** Antetul coloanei din defalcare, unde `label` n-ar încăpea. */
  short?: string;
  value: number;
  tone?: "default" | "danger" | "warning";
  /**
   * Totalul pe toată secția, afișat discret sub etichetă („din N”). Se dă doar
   * membrilor: la admin cifra proprie e deja totalul, deci ar fi redundant.
   */
  of?: number;
}

export interface ModuleCardBreakdownRow {
  id: string | null;
  name: string;
  /** Câte o valoare pentru fiecare `stat`, în aceeași ordine. */
  values: number[];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ModuleCard({
  href,
  title,
  description,
  stats,
  breakdown,
}: {
  href: string;
  title: string;
  description: string;
  stats: ModuleCardStat[];
  /** Defalcare pe responsabil (doar pentru admin). Lipsă → cardul arată doar cifrele. */
  breakdown?: ModuleCardBreakdownRow[];
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20 hover:bg-muted/40"
    >
      <h2 className="text-xl font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {/* Numărul de coloane urmează câte cifre are cardul: șase la sarcini,
          cinci la petiții. Fixat pe cinci, a șasea cădea singură pe alt rând. */}
      <div
        className={cn(
          "mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3",
          stats.length >= 6 ? "lg:grid-cols-6" : "lg:grid-cols-5",
        )}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <div
              className={cn(
                "text-2xl font-medium tabular-nums",
                s.tone === "danger" && s.value > 0 && "text-red-600",
                s.tone === "warning" && s.value > 0 && "text-amber-600",
              )}
            >
              {s.value}
            </div>
            <div className="text-xs text-muted-foreground" title={s.title}>
              {s.label}
            </div>
            {s.of !== undefined && (
              <div className="text-[11px] tabular-nums text-muted-foreground/70">
                din {s.of}
              </div>
            )}
          </div>
        ))}
      </div>
      {breakdown && breakdown.length > 0 && (
        <div className="mt-5 border-t pt-3">
          {/*
            O singură grilă pentru antet și rânduri, ca celulele să se alinieze
            pe coloane. Coloanele de cifre sunt „auto": fiecare se strânge după
            propria etichetă, în loc să ia toate lățimea celei mai late — așa
            rămâne loc pentru numele întreg. Rândurile folosesc `contents`,
            deci celulele lor intră direct în grilă.
          */}
          <div
            className="grid items-center gap-x-3"
            style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${stats.length}, auto)` }}
          >
            <span />
            {stats.map((s) => (
              <span
                key={s.label}
                className="pb-1.5 text-right text-[10px] text-muted-foreground"
              >
                {s.short ?? s.label}
              </span>
            ))}

            {breakdown.map((row) => (
              <div key={row.id ?? "none"} className="contents">
                <span className="flex min-w-0 items-center gap-1.5 py-1 text-xs">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className={cn("text-[9px]", avatarColor(row.id ?? "none"))}>
                      {initialsOf(row.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate" title={row.name}>
                    {row.name}
                  </span>
                </span>
                {row.values.map((value, i) => (
                  <span
                    key={stats[i]?.label ?? i}
                    className={cn(
                      "py-1 text-right text-xs tabular-nums",
                      // Zerourile se estompează: privirea merge la ce chiar există.
                      value === 0 && "text-muted-foreground/40",
                      value > 0 && stats[i]?.tone === "warning" && "text-amber-600",
                      value > 0 && stats[i]?.tone === "danger" && "text-red-600",
                    )}
                  >
                    {value}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}
