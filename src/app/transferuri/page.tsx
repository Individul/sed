import Link from "next/link";

import { getCurrentProfile, getTransfers } from "@/lib/queries";
import { TransfersWorkspace } from "@/components/transfers/transfers-workspace";
import { toISODate } from "@/lib/periods";

export const dynamic = "force-dynamic";

export default async function TransferuriPage() {
  const [profile, transfers] = await Promise.all([
    getCurrentProfile(),
    // Registrul întreg, o singură dată. Perioada se alege în pagină și taie din
    // ce e deja în memorie: schimbarea ei nu costă încă o interogare.
    getTransfers(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-4 xl:px-10">
      <div>
        <h1 className="text-2xl font-semibold">Transferuri</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Transferurile deținuților între penitenciare: cifre pe zi și penitenciar, nu persoane.{" "}
          <Link
            href="/transferuri/planificare"
            // Roșu la cerere, ca la „Versiune de tipărit" din Ședințe. În restul
            // aplicației roșul înseamnă „restant"; locurile astea două ies din
            // rând dinadins, ca legăturile către module vecine să sară în ochi.
            className="font-medium text-red-600 underline underline-offset-2 transition-colors hover:text-red-700"
          >
            Planificarea nominală
          </Link>{" "}
          se ține separat.
        </p>
      </div>

      <TransfersWorkspace
        transfers={transfers}
        // Ziua curentă vine de la server, ca perioada și zilele programate să
        // nu depindă de ceasul browserului.
        today={toISODate(new Date())}
        isAdmin={profile?.role === "admin"}
      />
    </main>
  );
}
