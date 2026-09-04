"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function changePassword(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (password.length < 8) {
    return { error: "Parola trebuie să aibă minim 8 caractere." };
  }
  if (password !== confirm) {
    return { error: "Parolele nu coincid." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Neautentificat." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { success: true };
}

export async function updateProfile(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const fullName = String(formData.get("full_name") || "").trim();
  if (!fullName) return { error: "Numele nu poate fi gol." };
  if (fullName.length > 200) return { error: "Numele e prea lung (max 200 caractere)." };

  const usernameRaw = String(formData.get("username") || "").trim();
  const username = usernameRaw ? usernameRaw.toLowerCase() : null;
  if (username !== null && !/^[a-z0-9._-]{3,30}$/.test(username)) {
    return { error: "Username invalid: 3-30 caractere, doar litere, cifre, . _ -" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Neautentificat." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, username })
    .eq("id", user.id)
    .select();
  if (error) {
    if (error.code === "23505") return { error: "Username-ul e deja folosit." };
    return { error: error.message };
  }
  if (!data || data.length === 0) return { error: "Nu s-a putut actualiza profilul." };

  revalidatePath("/");
  revalidatePath("/sarcini");
  revalidatePath("/admin");
  return { success: true };
}
