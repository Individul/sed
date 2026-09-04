import { createClient } from "@supabase/supabase-js";

// Client Supabase cu cheia service-role — DOAR pe server. Ocolește RLS și oferă
// Admin API (creare/ștergere utilizatori). Nu importa acest fișier în cod client.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
