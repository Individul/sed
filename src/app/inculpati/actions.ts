"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isCourt } from "@/lib/courts";

type Result = { error?: string; success?: boolean };

export interface DefendantInput {
  last_name: string;
  first_name: string;
  regime: string;
  established_on: string;
  court: string;
  case_number: string;
  /** Are măsură preventivă? De aici se citește categoria „prevenit". */
  preventive_measure: boolean;
  /** Data măsurii, dacă e știută. Ignorată când nu există măsură. */
  preventive_measure_on: string;
  note: string;
}

function validate(input: DefendantInput): string | null {
  if (!input.last_name.trim()) return "Numele e obligatoriu.";
  if (!input.first_name.trim()) return "Prenumele e obligatoriu.";
  if (input.regime !== "inchis" && input.regime !== "semiinchis") {
    return "Alege tipul de penitenciar.";
  }
  if (!input.established_on) return "Data stabilirii e obligatorie.";
  // Instanța e opțională, dar dacă e dată trebuie să fie una din listă: altfel
  // aceeași judecătorie ar ajunge scrisă în trei feluri în două evidențe.
  if (input.court && !isCourt(input.court)) return "Alege instanța din listă.";
  return null;
}

export async function saveDefendant(
  id: string | null,
  input: DefendantInput,
): Promise<Result> {
  const problem = validate(input);
  if (problem) return { error: problem };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const values = {
    last_name: input.last_name.trim(),
    first_name: input.first_name.trim(),
    regime: input.regime,
    established_on: input.established_on,
    court: input.court ? input.court : null,
    case_number: input.case_number.trim() ? input.case_number.trim() : null,
    preventive_measure: input.preventive_measure,
    // Oglindește `defendants_preventive` din migrarea 0028: fără măsură, data
    // se scrie `null` — o dată a unei măsuri care nu există ar fi o afirmație
    // despre nimic, iar baza ar respinge-o oricum.
    preventive_measure_on:
      input.preventive_measure && input.preventive_measure_on
        ? input.preventive_measure_on
        : null,
    note: input.note.trim() ? input.note.trim() : null,
    updated_by: userId,
  };

  // `.select()` pe ambele ramuri: un rând dispărut (șters de altcineva cât era
  // dialogul deschis) nu produce eroare, doar zero rânduri — iar fără
  // verificare am spune „Însemnare salvată." despre nimic.
  const { data, error } = id
    ? await supabase.from("defendants").update(values).eq("id", id).select()
    : await supabase.from("defendants").insert({ ...values, created_by: userId }).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/inculpati");
  return { success: true };
}

/**
 * Trecerea la condamnat. Data nu e opțională: starea și data se verifică una pe
 * alta în bază, iar un condamnat fără dată n-ar putea fi numărat pe luni.
 */
export async function markConvicted(id: string, convictedOn: string): Promise<Result> {
  if (!convictedOn) return { error: "Data condamnării e obligatorie." };
  // Data vine dintr-un câmp scris de mână, deci forma se verifică aici: altfel
  // „3 august" ar ajunge la bază și s-ar întoarce cu o eroare de Postgres, pe
  // care cel care a scris n-are cum s-o lege de ce a greșit.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(convictedOn) || Number.isNaN(Date.parse(convictedOn))) {
    return { error: "Data trebuie scrisă ca AAAA-LL-ZZ, de pildă 2026-08-03." };
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { data, error } = await supabase
    .from("defendants")
    .update({ status: "condamnat", convicted_on: convictedOn, updated_by: userId })
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/inculpati");
  return { success: true };
}

/** Readuce în lista de lucru o trecere făcută din greșeală. */
export async function undoConvicted(id: string): Promise<Result> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { data, error } = await supabase
    .from("defendants")
    .update({ status: "inculpat", convicted_on: null, updated_by: userId })
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/inculpati");
  return { success: true };
}

export async function deleteDefendant(id: string): Promise<Result> {
  const supabase = createClient();
  const { data, error } = await supabase.from("defendants").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Însemnarea nu există sau nu ai dreptul." };
  revalidatePath("/inculpati");
  return { success: true };
}
