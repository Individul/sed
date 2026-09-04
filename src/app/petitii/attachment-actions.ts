"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PetitionAttachment } from "@/lib/types";

type Result = { error?: string; success?: boolean };

export async function listAttachments(petitionId: string): Promise<PetitionAttachment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("petition_attachments")
    .select("*")
    .eq("petition_id", petitionId)
    .order("created_at", { ascending: true });
  // Grațios dacă migrarea 0013 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as PetitionAttachment[];
}

export async function recordAttachment(input: {
  petitionId: string;
  kind: "petitie" | "raspuns";
  path: string;
  name: string;
  mime: string;
  size: number;
}): Promise<Result> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { error } = await supabase.from("petition_attachments").insert({
    petition_id: input.petitionId,
    kind: input.kind,
    path: input.path,
    name: input.name,
    mime: input.mime,
    size: input.size,
    uploaded_by: userId,
  });
  if (error) return { error: error.message };

  // Fără notificare: scanarea se atașează imediat după înregistrare, deci ar
  // dubla „Petiție nouă" la fiecare petiție.
  revalidatePath("/petitii");
  return { success: true };
}

export async function deleteAttachment(id: string): Promise<Result> {
  const supabase = createClient();

  const { data: row } = await supabase
    .from("petition_attachments")
    .select("path")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("petition_attachments")
    .delete()
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Fișier inexistent sau fără permisiune." };

  // Rândul a dispărut → scoatem și obiectul, ca să nu rămână orfan.
  if (row?.path) {
    await supabase.storage.from("petitions").remove([row.path as string]);
  }

  revalidatePath("/petitii");
  return { success: true };
}

/** Link semnat, valabil 60 de secunde, pentru deschiderea fișierului. */
export async function getAttachmentUrl(
  path: string,
  downloadAs?: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("petitions")
    .createSignedUrl(path, 60, downloadAs ? { download: downloadAs } : undefined);
  if (error || !data?.signedUrl) return { error: error?.message ?? "Nu s-a putut genera linkul." };
  return { url: data.signedUrl };
}
