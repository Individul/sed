"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PeriodNavProps {
  /** Unde duce navigarea: `/sedinte` sau `/sedinte/raport`. */
  basePath: string;
  /** Intervalul afișat, scris în litere — ce vede omul între săgeți. */
  eticheta: string;
  /** Ancora perioadei dinainte (AAAA-LL-ZZ). */
  inapoi: string;
  /** Ancora celei următoare, sau `null` când suntem deja în perioada curentă. */
  inainte: string | null;
}

/**
 * Săgețile de mutat perioada, cu intervalul între ele.
 *
 * O singură piesă pentru ecran și pentru versiunea de tipărit. Prima oară
 * navigarea a fost pusă doar în versiunea de tipărit, iar pe ecran — locul în
 * care omul se uită de fapt — raportul a rămas țintuit pe perioada curentă. Ținute
 * separat, cele două ar apuca iar pe drumuri diferite.
 */
export function PeriodNav({ basePath, eticheta, inapoi, inainte }: PeriodNavProps) {
  const router = useRouter();
  const params = useSearchParams();

  const mergiLa = (la: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("la", la);
    router.push(`${basePath}?${q.toString()}`);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7 shrink-0"
        title="Perioada dinainte"
        aria-label="Perioada dinainte"
        onClick={() => mergiLa(inapoi)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="min-w-[13rem] text-center text-[13px] tabular-nums text-muted-foreground">
        {eticheta}
      </span>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7 shrink-0"
        title={inainte ? "Perioada următoare" : "Ești în perioada curentă"}
        aria-label="Perioada următoare"
        disabled={!inainte}
        onClick={() => inainte && mergiLa(inainte)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
