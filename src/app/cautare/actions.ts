"use server";

import { createClient } from "@/lib/supabase/server";
import {
  MIN_QUERY,
  search,
  type DefendantRow,
  type PetitionRow,
  type PlanRow,
  type SearchGroup,
  type TaskRow,
} from "@/lib/search";

/**
 * Caută în toate registrele deodată.
 *
 * Se cer doar coloanele în care se caută sau care se arată — nu rândurile
 * întregi. Descrierile petițiilor, observațiile, fișierele atașate ar traversa
 * rețeaua la fiecare tastă ca să fie aruncate.
 *
 * Fiecare interogare cade singură pe `[]` la eroare: o căutare care nu poate
 * citi un registru trebuie să le arate pe celelalte, nu să lase pagina goală.
 * Drepturile rămân cele din baza de date — se folosește clientul obișnuit, cu
 * RLS, deci fiecare vede exact ce vede și în module.
 */
export async function searchAll(query: string): Promise<SearchGroup[]> {
  if (query.trim().length < MIN_QUERY) return [];

  const supabase = createClient();

  const [tasks, petitions, plans, defendants] = await Promise.all([
    supabase
      .from("tasks")
      // `tags(*)` ca în `getTasks`: eticheta e esența sarcinii, deci se arată și
      // se caută. Restul rândului tot nu se cere.
      .select("id,title,description,status,tags(*)")
      .then((r) => (r.error ? [] : ((r.data ?? []) as unknown as TaskRow[]))),
    supabase
      .from("petitions")
      .select("id,number,petitioner,subject,status")
      .then((r) => (r.error ? [] : ((r.data ?? []) as unknown as PetitionRow[]))),
    supabase
      .from("transfer_plans")
      .select("id,last_name,first_name,court,institution,note,done")
      .then((r) => (r.error ? [] : ((r.data ?? []) as unknown as PlanRow[]))),
    supabase
      .from("defendants")
      .select("id,last_name,first_name,court,case_number,status,preventive_measure")
      .then((r) => (r.error ? [] : ((r.data ?? []) as unknown as DefendantRow[]))),
  ]);

  return search(query, { tasks, petitions, plans, defendants });
}
