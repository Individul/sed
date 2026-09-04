import Link from "next/link";

import { PenalTools } from "@/components/penal/penal-tools";

export const dynamic = "force-dynamic";

/**
 * Uneltele penale, pe o pagină.
 *
 * Au fost întâi ferestre, pe ideea că sunt socoteli pe care le faci și le
 * închizi. Dar în lățimea unei ferestre nu încăpea decât una pe rând, iar cele
 * două chiar merg împreună: cine socotește sfârșitul termenului socotește
 * aproape întotdeauna și categoria infracțiunii, și datele art. 91 și 92.
 * Împărțite în două ferestre, pedeapsa se scria de două ori.
 *
 * Nu e în bara de module: acolo stau registrele, care se completează zilnic.
 */
export default async function TermenPage() {
  return (
    <main className="mx-auto max-w-5xl p-4 xl:px-10">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Calculator termen</h1>
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Acasă
        </Link>
      </div>
      <PenalTools />
    </main>
  );
}
