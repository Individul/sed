import { getCurrentProfile, getDefendants } from "@/lib/queries";
import { DefendantList } from "@/components/defendants/defendant-list";

export const dynamic = "force-dynamic";

export default async function InculpatiPage() {
  const [defendants, profile] = await Promise.all([
    getDefendants(),
    getCurrentProfile(),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 xl:px-10">
      <div>
        <h1 className="text-2xl font-semibold">Preveniți și inculpați</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cu tip de penitenciar stabilit. Cine are măsură preventivă e prevenit, ceilalți
          inculpați. Cine devine condamnat iese din listă, dar rămâne în evidență.
        </p>
      </div>

      <DefendantList defendants={defendants} isAdmin={profile?.role === "admin"} />
    </main>
  );
}
