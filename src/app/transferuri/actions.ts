"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { INSTITUTIONS } from "@/lib/transfers";

type Result = { error?: string; success?: boolean };

/**
 * Ciocnirea cu cheia unică (zi + penitenciar + tip) nu e o defecțiune, ci cazul
 * obișnuit în care ziua a fost deja completată — mesajul spune ce urmează.
 */
const DUPLICAT =
  "Există deja un rând pentru penitenciarul acesta în ziua asta. " +
  "Editează-l în loc să adaugi altul.";

const LIPSA_LA_MODIFICARE =
  "Rândul nu mai există sau nu ai dreptul să-l modifici. Reîncarcă pagina.";

const LIPSA_LA_STERGERE = "Rândul nu mai există sau ștergerea e rezervată adminului.";

/** Cifrele vin din formular ca text; negativul și non-numericul cad aici. */
function toCount(value: unknown, label: string): number | string {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${label}: introdu un număr întreg.`;
  if (n < 0) return `${label}: numărul nu poate fi negativ.`;
  return n;
}

export interface TransferInput {
  transfer_date: string;
  institution: unknown;
  kind: string;
  plecati: unknown;
  sositi: unknown;
  note: string;
}

interface TransferValues {
  transfer_date: string;
  institution: number;
  kind: "planificat" | "urgent";
  plecati: number;
  sositi: number;
  note: string | null;
}

/**
 * Rândul de scris, sau mesajul de eroare dacă formularul nu ține.
 *
 * `total` lipsește dinadins: e coloană generată în Postgres, iar trimiterea ei ar
 * fi respinsă de bază.
 *
 * Un rând cu 0 și 0 rămâne valid: pe o zi programată în care n-a mișcat nimeni, e
 * singurul fel de a spune că ziua a avut loc — altfel ar fi raportată ca lipsă.
 */
function validate(input: TransferInput): TransferValues | string {
  if (!input.transfer_date) return "Alege ziua transferului.";

  const institution = Number(input.institution);
  // Aceeași listă ca în constrângerea din bază: nr. 6 suntem noi, nr. 14 nu există.
  if (!INSTITUTIONS.includes(institution)) return "Alege penitenciarul partener.";

  if (input.kind !== "planificat" && input.kind !== "urgent") {
    return "Alege tipul transferului: planificat sau urgent.";
  }

  const plecati = toCount(input.plecati, "Plecați");
  if (typeof plecati === "string") return plecati;
  const sositi = toCount(input.sositi, "Sosiți");
  if (typeof sositi === "string") return sositi;

  return {
    transfer_date: input.transfer_date,
    institution,
    kind: input.kind,
    plecati,
    sositi,
    note: input.note.trim() ? input.note.trim() : null,
  };
}

/** Registrul și cardul de pe pagina principală arată aceleași cifre. */
function revalidate() {
  revalidatePath("/transferuri");
  revalidatePath("/");
}

export async function createTransfer(input: TransferInput): Promise<Result> {
  const values = validate(input);
  if (typeof values === "string") return { error: values };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { error } = await supabase
    .from("transfers")
    .insert({ ...values, created_by: userId, updated_by: userId });
  if (error) {
    if ((error as { code?: string }).code === "23505") return { error: DUPLICAT };
    return { error: error.message };
  }

  revalidate();
  return { success: true };
}

export async function updateTransfer(id: string, input: TransferInput): Promise<Result> {
  const values = validate(input);
  if (typeof values === "string") return { error: values };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  // `.select()` nu e decor: un rând filtrat de RLS nu produce eroare, deci fără
  // el am raporta succes pentru o modificare care nu s-a întâmplat.
  const { data, error } = await supabase
    .from("transfers")
    .update({ ...values, updated_by: userId })
    .eq("id", id)
    .select();
  if (error) {
    // Mutarea rândului peste unul existent (altă zi, alt penitenciar, alt tip).
    if ((error as { code?: string }).code === "23505") return { error: DUPLICAT };
    return { error: error.message };
  }
  if (!data || data.length === 0) return { error: LIPSA_LA_MODIFICARE };

  revalidate();
  return { success: true };
}

export async function deleteTransfer(id: string): Promise<Result> {
  const supabase = createClient();
  const { data, error } = await supabase.from("transfers").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: LIPSA_LA_STERGERE };

  revalidate();
  return { success: true };
}
