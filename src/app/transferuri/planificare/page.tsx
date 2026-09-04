import Link from "next/link";

import { getCurrentProfile, getTransferPlans } from "@/lib/queries";
import { PlanList } from "@/components/transfers/plan-list";

export const dynamic = "force-dynamic";

export default async function PlanificarePage() {
  const [plans, profile] = await Promise.all([
    getTransferPlans(),
    getCurrentProfile(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 xl:px-10">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Planificarea transferurilor</h1>
          <Link
            href="/transferuri"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Registrul cifrelor
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Persoanele cu ședințe programate, grupate pe ziua de transfer. Ziua se recalculează
          singură dacă ședința se amână.
        </p>
      </div>

      <PlanList plans={plans} isAdmin={profile?.role === "admin"} />
    </main>
  );
}
