"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { restoreRefusal } from "@/lib/backup";

export async function setUserRole(
  userId: string,
  role: "admin" | "member",
): Promise<{ error?: string; success?: boolean }> {
  if (role !== "admin" && role !== "member") return { error: "Rol invalid." };
  const supabase = createClient();

  // Nu-ți poți retrograda propriul rol (protecție și în cod, nu doar în UI).
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user?.id === userId && role === "member") {
    return { error: "Nu-ți poți retrograda propriul rol." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Fără permisiune sau utilizator inexistent." };
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/sarcini");
  return { success: true };
}

type RestoreResult = {
  error?: string;
  inserted?: { tasks: number; tags: number; task_tags: number; comments: number };
};

// Restaurare non-distructivă: adaugă doar înregistrările lipsă (ON CONFLICT DO
// NOTHING), fără a șterge sau suprascrie ceva existent. Doar admin.
//
// Acoperă cele patru tabele ale formatului vechi (`version: 1`). Fișierele de
// azi au cincisprezece tabele și sunt refuzate aici — vezi `restoreRefusal`
// pentru motiv.
export async function restoreBackup(payload: unknown): Promise<RestoreResult> {
  const supabase = createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") return { error: "Doar adminul poate restaura." };

  // Aceeași verificare e și în componentă, ca omul s-o afle înainte de
  // confirmare. Aici e ușa propriu-zisă, iar ușa nu se lasă în seama butonului:
  // acțiunea scrie în baza de date, deci ea trebuie să refuze formatul pe care
  // nu-l poate importa întreg.
  const refusal = restoreRefusal(payload);
  if (refusal) return { error: refusal };

  const root = (payload as { data?: Record<string, unknown> } | null) ?? null;
  const d = root?.data ?? {};
  const tasks = Array.isArray(d.tasks) ? (d.tasks as Record<string, unknown>[]) : null;
  if (!tasks) return { error: "Fișier de backup invalid (lipsește data.tasks)." };
  const tags = Array.isArray(d.tags) ? (d.tags as Record<string, unknown>[]) : [];
  const taskTags = Array.isArray(d.task_tags) ? (d.task_tags as Record<string, unknown>[]) : [];
  const comments = Array.isArray(d.comments) ? (d.comments as Record<string, unknown>[]) : [];

  const inserted = { tasks: 0, tags: 0, task_tags: 0, comments: 0 };

  // Ordine pentru chei străine: tags -> tasks -> task_tags -> comments.
  if (tags.length) {
    const { data: r, error } = await supabase
      .from("tags")
      .upsert(tags, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: `Etichete: ${error.message}` };
    inserted.tags = r?.length ?? 0;
  }
  if (tasks.length) {
    const { data: r, error } = await supabase
      .from("tasks")
      .upsert(tasks, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: `Sarcini: ${error.message}` };
    inserted.tasks = r?.length ?? 0;
  }
  if (taskTags.length) {
    const { data: r, error } = await supabase
      .from("task_tags")
      .upsert(taskTags, { onConflict: "task_id,tag_id", ignoreDuplicates: true })
      .select("task_id");
    if (error) return { error: `Legături etichetă: ${error.message}` };
    inserted.task_tags = r?.length ?? 0;
  }
  if (comments.length) {
    const { data: r, error } = await supabase
      .from("comments")
      .upsert(comments, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: `Comentarii: ${error.message}` };
    inserted.comments = r?.length ?? 0;
  }

  revalidatePath("/");
  revalidatePath("/sarcini");
  revalidatePath("/admin");
  return { inserted };
}

// Creează un utilizator cu username + parolă (fără email real — se folosește un
// email intern). Necesită cheia service-role. Doar admin.
export async function createUser(input: {
  full_name: string;
  username: string;
  password: string;
}): Promise<{ error?: string; success?: boolean }> {
  const fullName = input.full_name.trim();
  const username = input.username.trim().toLowerCase();
  const password = input.password;

  if (!fullName) return { error: "Numele e obligatoriu." };
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return { error: "Username invalid: 3-30 caractere, doar litere, cifre, . _ -" };
  }
  if (password.length < 8) return { error: "Parola trebuie să aibă minim 8 caractere." };

  // Apelantul trebuie să fie admin.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Neautentificat." };
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") return { error: "Doar adminul poate crea utilizatori." };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Cheia service-role (SUPABASE_SERVICE_ROLE_KEY) nu e configurată." };
  }

  // Username unic (verificare prietenoasă înainte de a crea contul).
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) return { error: "Username-ul e deja folosit." };

  const admin = createAdminClient();
  const email = `${username}@intern.local`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created?.user) {
    return { error: createErr?.message ?? "Nu s-a putut crea utilizatorul." };
  }

  // Trigger-ul handle_new_user a creat profilul (cu full_name din metadata).
  // Setăm username-ul (service-role ocolește RLS).
  const { error: profErr } = await admin
    .from("profiles")
    .update({ username, full_name: fullName })
    .eq("id", created.user.id);
  if (profErr) {
    // Rollback: ștergem contul creat ca să nu rămână orfan.
    await admin.auth.admin.deleteUser(created.user.id);
    if ((profErr as { code?: string }).code === "23505") {
      return { error: "Username-ul e deja folosit." };
    }
    return { error: `Nu s-a putut seta profilul: ${profErr.message}` };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/sarcini");
  return { success: true };
}
