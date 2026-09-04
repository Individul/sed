"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; success?: boolean; removed?: string };

/**
 * Bifează un termen anume, nu „obligația".
 *
 * `due_date` vine din calcul, nu din ceasul apăsării: altfel o bifă pusă pe 2
 * septembrie n-ar spune dacă acoperă termenul din august sau pe cel din
 * septembrie — adică exact întrebarea la care evidența trebuie să răspundă.
 */
export async function markObligationDone(
  obligationId: string,
  dueDate: string,
): Promise<Result> {
  if (!obligationId || !dueDate) return { error: "Lipsește obligația sau termenul." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { error } = await supabase.from("obligation_completions").insert({
    obligation_id: obligationId,
    due_date: dueDate,
    completed_by: userId,
  });
  if (error) {
    // Doi oameni au bifat același termen în același moment.
    if ((error as { code?: string }).code === "23505") {
      return { error: "Termenul e deja bifat." };
    }
    return { error: error.message };
  }

  revalidatePath("/obligatii");
  revalidatePath("/");
  return { success: true };
}

/**
 * Scoate ultima bifă pusă — cea cu termenul cel mai mare din evidență.
 *
 * Ținta o alege serverul, dintr-o interogare, nu clientul, dintr-un calcul:
 * varianta veche recalcula pe ceasul clientului „cel mai recent termen trecut",
 * care după o bifă pusă din timp NU e bifa pusă acum. Anularea ștergea atunci
 * înregistrarea reală a lunii trecute și o lăsa pe cea greșită — registrul
 * mințea în ambele direcții, iar utilizatorului i se spunea că totul a mers.
 *
 * Data ștearsă se întoarce la client, ca mesajul să spună exact ce s-a scos.
 */
export async function undoObligationDone(obligationId: string): Promise<Result> {
  if (!obligationId) return { error: "Lipsește obligația." };

  const supabase = createClient();
  const { data: latest, error: lookupError } = await supabase
    .from("obligation_completions")
    .select("id, due_date")
    .eq("obligation_id", obligationId)
    .order("due_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) return { error: lookupError.message };
  if (!latest) return { error: "Nu există nicio bifă de scos." };

  const { data, error } = await supabase
    .from("obligation_completions")
    .delete()
    .eq("id", latest.id)
    .select();
  if (error) return { error: error.message };
  // Doi oameni au apăsat anularea în același moment: al doilea nu mai are ce
  // șterge, iar un „succes" aici ar ascunde că bifa dispăruse deja.
  if (!data || data.length === 0) return { error: "Bifa nu mai există." };

  revalidatePath("/obligatii");
  revalidatePath("/");
  return { success: true, removed: latest.due_date as string };
}
