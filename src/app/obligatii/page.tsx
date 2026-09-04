import { getObligations } from "@/lib/queries";
import { ObligationList } from "@/components/obligations/obligation-list";
import { pendingFor } from "@/lib/obligations";

export const dynamic = "force-dynamic";

export default async function ObligatiiPage() {
  const { obligations, completed } = await getObligations();

  const now = new Date();
  const items = obligations.map((o) => pendingFor(o, completed.get(o.id) ?? new Set(), now));

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 xl:px-10">
      <div>
        <h1 className="text-2xl font-semibold">Informări periodice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Obligațiile cu termen care se repetă. Termenul se recalculează singur, iar bifa se
          leagă de termenul acoperit, nu de ziua în care ai apăsat.
        </p>
      </div>

      <ObligationList items={items} />
    </main>
  );
}
