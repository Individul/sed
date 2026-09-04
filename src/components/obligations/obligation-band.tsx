import Link from "next/link";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { AlertCircle, AlertTriangle, Clock } from "lucide-react";

import {
  bandUrgency,
  needsAttention,
  sortPending,
  type ObligationUrgency,
  type Pending,
} from "@/lib/obligations";
import { parseISODate } from "@/lib/periods";
import { cn } from "@/lib/utils";

/**
 * Cele trei trepte, într-un singur loc.
 *
 * Fondul se închide odată cu urgența — galben deschis, morcoviu, roșu — fiindcă
 * altfel ordinea se rupe: o bandă „astăzi” mai apăsată decât una „depășit” ar
 * spune că ziua termenului e mai gravă decât termenul ratat.
 */
const TONE: Record<
  ObligationUrgency,
  { box: string; text: string; title: string; Icon: typeof Clock }
> = {
  apropiat: {
    box: "border-amber-300 bg-amber-50 hover:bg-amber-100/70",
    text: "text-amber-900",
    title: "Termene apropiate",
    Icon: Clock,
  },
  astazi: {
    box: "border-orange-400 bg-orange-100 hover:bg-orange-200/70",
    text: "text-orange-900",
    title: "Termene astăzi",
    Icon: AlertCircle,
  },
  restant: {
    box: "border-red-400 bg-red-100 hover:bg-red-200/70",
    text: "text-red-900",
    title: "Termene depășite",
    Icon: AlertTriangle,
  },
};

/**
 * Obligațiile apropiate sau restante, în capul paginii principale.
 *
 * Apare doar când e ceva de făcut. O bandă permanentă devine tapet: ochiul o
 * învață și n-o mai citește tocmai în ziua în care scrie ceva important.
 */
export function ObligationBand({ items }: { items: Pending[] }) {
  const rows = sortPending(items.filter(needsAttention));
  if (rows.length === 0) return null;

  const { box, text, title, Icon } = TONE[bandUrgency(rows)];

  return (
    <Link
      href="/obligatii"
      className={cn("mb-6 block rounded-xl border px-4 py-3 transition-colors", box)}
    >
      <div className={cn("flex items-center gap-2 text-[13px] font-medium", text)}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {title}
      </div>

      <ul className={cn("mt-1.5 space-y-1 text-[13px]", text)}>
        {rows.map((p) => (
          <li key={p.obligation.id} className="flex flex-wrap items-baseline gap-x-2">
            <span>{p.obligation.title}</span>
            {/* Rândul de azi rămâne recunoscut și într-o bandă roșie, unde
                culoarea vorbește deja despre restanțe, nu despre el. */}
            <span className={cn("opacity-80", p.days === 0 && "font-semibold opacity-100")}>
              — {p.obligation.recipient},{" "}
              {p.overdue
                ? `restant din ${format(parseISODate(p.due), "d MMMM", { locale: ro })}`
                : p.days === 0
                  ? "astăzi"
                  : `până pe ${format(parseISODate(p.due), "d MMMM", { locale: ro })}`}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
