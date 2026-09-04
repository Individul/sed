import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";

import { CHANGELOG } from "@/lib/changelog";

export const dynamic = "force-dynamic";

export default async function NoutatiPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 xl:px-10">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Noutăți</h1>
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Acasă
        </Link>
      </div>

      {CHANGELOG.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nimic deocamdată.</p>
      ) : (
        <ul className="space-y-3">
          {CHANGELOG.map((entry) => (
            <li key={`${entry.date}-${entry.text}`} className="flex gap-4">
              <span className="w-24 shrink-0 tabular-nums text-[13px] text-muted-foreground">
                {format(parseISO(entry.date), "d MMM yyyy", { locale: ro })}
              </span>
              <span className="text-sm leading-relaxed">{entry.text}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
