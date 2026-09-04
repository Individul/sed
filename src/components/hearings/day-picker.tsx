"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { parseISODate, toISODate } from "@/lib/periods";

interface DayPickerProps {
  /** Ziua deschisă acum (AAAA-LL-ZZ). */
  day: string;
  /** Ziua curentă, calculată pe server ca să nu depindă de ceasul browserului. */
  today: string;
}

/**
 * Alegerea zilei pentru introducere. În practică se completează ziua curentă
 * sau cea precedentă, deci săgețile acoperă aproape tot; calendarul rămâne
 * pentru saltul la o zi îndepărtată.
 */
export function DayPicker({ day, today }: DayPickerProps) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (iso: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("zi", iso);
    router.push(`/sedinte?${q.toString()}`);
  };

  const shifted = (n: number) => toISODate(addDays(parseISODate(day), n));
  const isToday = day === today;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9"
        aria-label="Ziua precedentă"
        onClick={() => go(shifted(-1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <input
        aria-label="Alege ziua"
        type="date"
        value={day}
        // Registrul consemnează ce s-a petrecut: ziua de mâine n-are ce căuta.
        max={today}
        onChange={(e) => {
          if (e.target.value) go(e.target.value);
        }}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
      />

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9"
        aria-label="Ziua următoare"
        disabled={isToday}
        onClick={() => go(shifted(1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isToday && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => go(today)}
        >
          Azi
        </Button>
      )}
    </div>
  );
}
