import Link from "next/link";

import { TestingWatermark } from "@/components/layout/testing-watermark";
import { CumulTool } from "@/components/penal/cumul-tool";

export const dynamic = "force-dynamic";

/**
 * Art. 84 alin. (4) sau art. 85 — care se aplică la a doua sentință.
 *
 * Pagină proprie, nu o a treia secțiune la /termen: acolo se socotește un termen
 * pe o pedeapsă deja stabilită, aici se răspunde la o întrebare de dinaintea
 * pedepsei. Ce au în comun sunt datele, nu socoteala.
 *
 * Poartă filigranul „în testare", ca statisticile. Aici cântărește mai greu
 * decât acolo: regula de despărțire a fost deja o dată legată greșit — pe
 * sentința dinainte, nu pe prima — și a ieșit la iveală abia dintr-un dosar
 * adevărat. Până se plimbă prin destule dosare, răspunsul de aici se verifică,
 * nu se preia.
 */
export default async function CumulPage() {
  return (
    <>
      {/*
       * `relative` întinde filigranul exact peste pagină; `isolate` îi ține
       * `z-10` închis aici. Ca la /statistici.
       */}
      <main className="relative isolate mx-auto max-w-5xl p-4 xl:px-10">
        <TestingWatermark />
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Concurs de infracțiuni sau cumul de sentințe</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Acasă
          </Link>
        </div>
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          Când un condamnat primește încă o sentință, temeiul e art. 84 alin. (4) sau
          art. 85. Le desparte o singură întrebare: era omul deja condamnat când a
          săvârșit fapta? Deci data săvârșirii față de data pronunțării primei sentințe —
          „sentinţa în prima cauză”, cum îi zice art. 84 alin. (4). Sentințele pot fi
          oricâte: se așază în ordinea pronunțării, iar temeiul se hotărăște pentru
          fiecare.
        </p>
        <CumulTool />
      </main>
    </>
  );
}
