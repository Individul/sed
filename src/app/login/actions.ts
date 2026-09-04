"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInWithPassword(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");
  if (!identifier || !password) return { error: "Introdu email/username și parolă." };

  const supabase = createClient();

  // Fără "@" => tratăm ca username și îl rezolvăm la emailul contului.
  let email = identifier;
  if (!identifier.includes("@")) {
    const { data, error } = await supabase.rpc("email_for_login", { identifier });
    if (error || !data) return { error: "Date de autentificare incorecte." };
    email = data as string;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Mesaj generic intenționat: nu dezvăluim ce email/username există.
  if (error) return { error: "Date de autentificare incorecte." };

  redirect("/");
}
