import { AlertTriangle, Info } from "lucide-react";

import { backupStatus, type BackupRun } from "@/lib/backup";
import { formatDateRo } from "@/lib/periods";
import { cn } from "@/lib/utils";

interface BackupStatusProps {
  /** Ultima rulare, reușită sau nu. */
  last: BackupRun | null;
  /** Ultima rulare reușită, oricât de departe ar fi. */
  lastSuccess: BackupRun | null;
  /** Momentul curent, venit de la server — nu doar ziua. */
  now: Date;
  className?: string;
}

/** Româna cere „de" de la 20 în sus: 19 zile, dar 20 de zile. */
function countRo(n: number, one: string, many: string): string {
  const rest = n % 100;
  const de = n >= 20 && (rest === 0 || rest >= 20) ? "de " : "";
  return `${n} ${de}${n === 1 ? one : many}`;
}

/** „acum 4 zile" spune mai repede decât data cât de veche e copia. */
function ago(days: number | null): string {
  if (days === null) return "";
  if (days <= 0) return " (azi)";
  if (days === 1) return " (ieri)";
  return ` (acum ${countRo(days, "zi", "zile")})`;
}

/**
 * Starea copiei automate, sub titlul paginii de administrare.
 *
 * Rostul întregii funcții e aici: o copie care se oprește în tăcere e mai rea
 * decât lipsa uneia, fiindcă te crezi acoperit tocmai când nu ești. Restul e
 * mecanism; asta e partea care face defectarea mecanismului vizibilă.
 *
 * De aceea stă sub titlu și nu în secțiunea „Backup & restaurare" de mai jos:
 * ce trebuie citit fără să fie căutat nu se pune sub falduri de pagină.
 *
 * Greutatea vizuală urmează un singur criteriu — ești acoperit acum sau nu:
 *
 * - **în regulă** — o linie ștearsă, fără chenar. Într-o zi bună nu are ce să
 *   întrerupă privirea, altfel banda se transformă în mobilier și nu se mai
 *   citește nici în ziua în care contează.
 * - **eșec proaspăt peste o copie recentă** — bandă neutră. S-a stricat ceva,
 *   dar copia de alaltăieri e tot acolo; galbenul aici ar fi strigat degeaba.
 * - **învechit, fără reușită, n-a rulat niciodată** — bandă galbenă, aceeași
 *   cu a zilelor de transfer necompletate: nu ești acoperit.
 */
export function BackupStatus({ last, lastSuccess, now, className }: BackupStatusProps) {
  const status = backupStatus({ last, lastSuccess }, now);

  const fact = (
    <>
      {status.lastSuccessAt ? (
        <>
          Ultima copie reușită:{" "}
          <span className="font-medium">{formatDateRo(new Date(status.lastSuccessAt))}</span>
          {ago(status.daysSince)}.
        </>
      ) : (
        // Fără dată nu se scrie „niciodată" pe un rând care există totuși: se
        // spune ce se știe, adică nimic dovedit.
        <>Nicio copie reușită înregistrată.</>
      )}
      {status.filesPending > 0 && (
        <>
          {" "}
          {status.level === "ok" ? (
            // Capcana restanței: fișierele se iau cu porția prin construcție,
            // deci un rest nu e o defecțiune. Semnalul rău e restanța care nu
            // scade de la o zi la alta, iar acela se vede în timp.
            <>
              Încă {countRo(status.filesPending, "fișier", "fișiere")} de copiat — se iau câteva
              pe noapte.
            </>
          ) : (
            // Când copia s-a rupt, „se iau câteva pe noapte" ar fi o minciună
            // liniștitoare: nu se mai ia nimic. Dar nici „încă N fără copie" nu
            // se poate spune la prezent — cifra vine de la ultima rulare
            // reușită, care poate fi de acum câteva zile, iar de atunci pot fi
            // mai multe. Trecutul e singurul timp pe care numărul ăsta îl
            // acoperă, iar legat de rularea de atunci nu e mai puțin
            // îngrijorător: fișierele acelea tot n-au copie.
            <>
              La ultima copie reușită mai erau{" "}
              {countRo(status.filesPending, "fișier", "fișiere")} fără copie.
            </>
          )}
        </>
      )}
    </>
  );

  if (status.level === "ok") {
    return (
      <p className={cn("px-1 text-[13px] text-muted-foreground", className)}>
        {fact} {status.hint}
      </p>
    );
  }

  const warn = status.level === "warn";
  const Icon = warn ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px]",
        warn ? "border-amber-300 bg-amber-50 text-amber-900" : "bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {/* `min-w-0` nu e de prisos: fără el, un motiv de eroare fără spații —
          o adresă lungă, un jeton — ar întinde elementul flex peste lățimea
          paginii, iar `break-words` n-ar mai avea de unde rupe. */}
      <div className="min-w-0 space-y-1">
        <p>
          {fact} {status.hint}
        </p>
        {/* Textul vine dintr-un răspuns HTTP străin. E deja strâns pe un rând
            și tăiat în `backupStatus`; aici i se dă doar voie să se rupă. */}
        {status.error && (
          <p className={cn("break-words", warn ? "text-amber-800/80" : "text-muted-foreground/80")}>
            Motivul ultimei încercări: {status.error}
          </p>
        )}
      </div>
    </div>
  );
}
