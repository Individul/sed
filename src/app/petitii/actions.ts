"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyPetition } from "@/lib/notify-petition";
import { hasChanges } from "@/lib/changes";
import { STATUS_LABEL } from "@/components/petitions/meta";
import type { PetitionStatus, PetitionerType } from "@/lib/types";

type Result = { error?: string; success?: boolean };
/** La creare întoarcem și identitatea rândului, ca dialogul să treacă direct
 *  în modul editare și să permită atașarea fișierelor fără a fi redeschis. */
type CreateResult = Result & { id?: string; number?: string };

export interface PetitionInput {
  petitioner: string;
  petitioner_type: PetitionerType;
  subject: string;
  received_date: string;
  assignee_id: string;
  status: PetitionStatus;
  response: string;
  response_date: string;
}

// Data curentă pe ceasul serverului — pe Vercel acela e UTC, deci între miezul
// nopții și ora 3 la Chișinău ziua e cea precedentă. Comentariul de dinainte
// pretindea „fusul local", ceea ce pe server nu e adevărat; problema e notată
// la fișa despre fusul orar și se rezolvă o dată pentru toate modulele, nu
// aici. Până atunci, măcar TOATE datele din fișier ies din aceeași funcție.
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yearSuffix(dateStr: string): string {
  const y = (dateStr || "").slice(0, 4);
  return (y || String(new Date().getFullYear())).slice(-2);
}

function normalize(input: PetitionInput) {
  return {
    petitioner: input.petitioner.trim(),
    petitioner_type: input.petitioner_type,
    subject: input.subject.trim() ? input.subject.trim() : null,
    // `todayLocal()`, nu `toISOString()`: al doilea e mereu UTC, deci același
    // fișier ar fi avut două „azi"-uri diferite seara.
    received_date: input.received_date || todayLocal(),
    status: input.status,
    response: input.response.trim() ? input.response.trim() : null,
    response_date: input.response_date ? input.response_date : null,
    assignee_id: input.assignee_id ? input.assignee_id : null,
  };
}

export async function createPetition(
  numberPrefix: string,
  input: PetitionInput,
): Promise<CreateResult> {
  const prefix = numberPrefix.trim();
  if (!prefix) return { error: "Numărul de înregistrare e obligatoriu." };
  if (!input.petitioner.trim()) return { error: "Petiționarul e obligatoriu." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const nt = normalize(input);
  const number = `${prefix}/${yearSuffix(nt.received_date)}`;
  const { data, error } = await supabase
    .from("petitions")
    .insert({ ...nt, number, created_by: userId })
    .select("id, number")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: "Există deja o petiție cu acest număr." };
    }
    return { error: error.message };
  }
  const ref = {
    id: data.id as string,
    number: data.number as string,
    assignee_id: nt.assignee_id,
    created_by: userId,
  };
  // Adminii află de orice petiție nouă, chiar dacă autorul și-a atribuit-o singur.
  await notifyPetition("created", ref, userId);
  if (nt.assignee_id) {
    // Adminii au primit deja „created" pentru aceeași acțiune — fără copie dublă.
    await notifyPetition("assigned", ref, userId, undefined, false);
  }

  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true, id: ref.id, number: ref.number };
}

export async function updatePetition(
  id: string,
  number: string,
  input: PetitionInput,
): Promise<Result> {
  if (!number.trim()) return { error: "Numărul de înregistrare e obligatoriu." };
  if (!input.petitioner.trim()) return { error: "Petiționarul e obligatoriu." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const nt = normalize(input);

  // Rândul de dinainte: spune ce anume s-a schimbat și dacă s-a schimbat ceva.
  const { data: prev } = await supabase
    .from("petitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const payload = { ...nt, number: number.trim() };
  const { data, error } = await supabase
    .from("petitions")
    .update(payload)
    .eq("id", id)
    .select();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: "Există deja o petiție cu acest număr." };
    }
    // Refuzul RLS ajungea la utilizator ca eroare Postgres în engleză. Cazul
    // realist: schimbarea responsabilului de către cineva care nu e creator —
    // WITH CHECK evaluează rândul nou, în care el n-ar mai fi nici creator,
    // nici responsabil. Selectorul e acum blocat pentru cazul ăsta, dar poarta
    // adevărată e baza, iar mesajul ei trebuie să fie pe limba utilizatorului.
    if ((error as { code?: string }).code === "42501") {
      return {
        error:
          "Baza de date a refuzat modificarea: doar creatorul petiției sau un " +
          "administrator poate schimba responsabilul.",
      };
    }
    return { error: error.message };
  }
  if (!data || data.length === 0) return { error: "Petiție inexistentă sau fără permisiune." };

  // Un „Salvează" care n-a schimbat nimic nu trebuie să notifice pe nimeni.
  if (prev && userId && hasChanges(prev, payload)) {
    const ref = {
      id,
      number: number.trim(),
      assignee_id: nt.assignee_id,
      created_by: prev.created_by as string,
    };
    if (nt.assignee_id && nt.assignee_id !== prev.assignee_id) {
      await notifyPetition("assigned", ref, userId);
    } else if (nt.status !== prev.status) {
      await notifyPetition("status", ref, userId, STATUS_LABEL[nt.status]);
    } else {
      await notifyPetition("edited", ref, userId);
    }
  }

  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true };
}

export async function deletePetition(id: string): Promise<Result> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  // Datele se citesc înainte: după ștergere nu mai există de unde compune mesajul.
  const { data: prev } = await supabase
    .from("petitions")
    .select("number, assignee_id, created_by")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase.from("petitions").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Petiție inexistentă sau fără permisiune." };

  if (prev && userId) {
    await notifyPetition(
      "deleted",
      {
        id,
        number: prev.number as string,
        assignee_id: prev.assignee_id as string | null,
        created_by: prev.created_by as string,
      },
      userId,
    );
  }

  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true };
}

// Finalizare rapidă: trece petiția în „Soluționat" și completează data
// răspunsului cu ziua curentă dacă lipsește. Dreptul e impus de RLS
// (admin / creator / responsabil) — dacă lipsește, update-ul atinge 0 rânduri.
export async function finalizePetition(id: string): Promise<Result> {
  const supabase = createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: prev } = await supabase
    .from("petitions")
    .select("response_date, number, assignee_id, created_by")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("petitions")
    .update({
      status: "solutionat",
      response_date: (prev?.response_date as string | null) ?? todayLocal(),
    })
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Petiție inexistentă sau fără permisiune." };

  if (prev && userId) {
    await notifyPetition(
      "status",
      {
        id,
        number: prev.number as string,
        assignee_id: prev.assignee_id as string | null,
        created_by: prev.created_by as string,
      },
      userId,
      STATUS_LABEL.solutionat,
    );
  }

  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true };
}
