"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";

import { CHANGELOG, HUB_CHANGELOG_COUNT, isNewSince } from "@/lib/changelog";

const STORAGE_KEY = "changelog-seen";

export function ChangelogSection() {
  // localStorage nu există la randarea pe server: se citește după montare, ca
  // marcajul „nou" să nu producă nepotrivire de hidratare. Tot atunci se
  // însemnează vizita, deci marcajele dispar la următoarea intrare.
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    setLastSeen(window.localStorage.getItem(STORAGE_KEY));
    const newest = CHANGELOG[0]?.date;
    if (newest) window.localStorage.setItem(STORAGE_KEY, newest);
  }, []);

  const shown = CHANGELOG.slice(0, HUB_CHANGELOG_COUNT);
  if (shown.length === 0) return null;

  return (
    <section className="mt-8 border-t pt-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium">Noutăți</h2>
        {CHANGELOG.length > shown.length && (
          <Link
            href="/noutati"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Vezi toate
          </Link>
        )}
      </div>
      <ul className="space-y-1.5">
        {shown.map((entry) => (
          <li key={`${entry.date}-${entry.text}`} className="flex items-baseline gap-3">
            <span className="w-14 shrink-0 tabular-nums text-xs text-muted-foreground">
              {format(parseISO(entry.date), "d MMM", { locale: ro })}
            </span>
            <span className="min-w-0 flex-1 text-[13px] leading-relaxed">{entry.text}</span>
            {isNewSince(entry.date, lastSeen) && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                nou
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
