"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { HearingCounts } from "@/lib/hearings";

type Result = { error?: string; success?: boolean };

/** Cifrele vin din formular ca text; negativul și non-numericul cad aici. */
function toCount(value: unknown, label: string): number | string {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${label}: introdu un număr întreg.`;
  if (n < 0) return `${label}: numărul nu poate fi negativ.`;
  return n;
}

export interface HearingInput {
  session_date: string;
  tc_petrecute: unknown;
  tc_amanate: unknown;
  ij_petrecute: unknown;
  ij_amanate: unknown;
  note: string;
}

const FIELDS: { key: keyof HearingCounts; label: string }[] = [
  { key: "tc_petrecute", label: "Teleconferință — petrecute" },
  { key: "tc_amanate", label: "Teleconferință — amânate" },
  { key: "ij_petrecute", label: "Instanța de judecată — petrecute" },
  { key: "ij_amanate", label: "Instanța de judecată — amânate" },
];

/**
 * Salvează ziua. Registrul are un singur rând pe zi, deci o a doua introducere
 * pentru aceeași dată o corectează pe prima în loc să adauge un duplicat —
 * cine a schimbat și când rămâne în jurnalul de audit.
 */
export async function saveHearing(input: HearingInput): Promise<Result> {
  if (!input.session_date) return { error: "Alege ziua." };

  const counts: Partial<HearingCounts> = {};
  for (const f of FIELDS) {
    const parsed = toCount(input[f.key], f.label);
    if (typeof parsed === "string") return { error: parsed };
    counts[f.key] = parsed;
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const values = {
    ...(counts as HearingCounts),
    note: input.note.trim() ? input.note.trim() : null,
    updated_by: userId,
  };

  // Nu `upsert`: acela ar rescrie și `created_by`, adică cine a deschis ziua
  // s-ar pierde la prima corectare făcută de altcineva.
  const { data: existing } = await supabase
    .from("hearings")
    .select("id")
    .eq("session_date", input.session_date)
    .maybeSingle();

  if (existing) {
    // `.select()` nu e decor: un rând filtrat sau dispărut nu produce eroare,
    // deci fără el am raporta succes pentru o corectare care nu s-a întâmplat
    // — de pildă când adminul tocmai a șters ziua deschisă în alt tab.
    const { data, error } = await supabase
      .from("hearings")
      .update(values)
      .eq("session_date", input.session_date)
      .select();
    if (error) return { error: error.message };
    if (!data || data.length === 0) {
      return { error: "Ziua nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
    }
  } else {
    const { error } = await supabase
      .from("hearings")
      .insert({ session_date: input.session_date, ...values, created_by: userId });
    if (error) {
      // Doi oameni au deschis aceeași zi în același moment.
      if ((error as { code?: string }).code === "23505") {
        return { error: "Ziua tocmai a fost introdusă de altcineva. Reîncarcă pagina." };
      }
      return { error: error.message };
    }
  }

  revalidatePath("/sedinte");
  return { success: true };
}

export async function deleteHearing(date: string): Promise<Result> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hearings")
    .delete()
    .eq("session_date", date)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Ziua nu există sau nu ai dreptul s-o ștergi." };
  revalidatePath("/sedinte");
  return { success: true };
}
