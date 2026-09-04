/**
 * Butonul „Descarcă backup" din pagina de administrare.
 *
 * Scrie exact același fișier ca și copia zilnică (`/api/backup`) — aceleași
 * tabele, aceeași ordine, același `version: 2` — fiindcă amândouă trec prin
 * `buildDump`. Cine restaurează cândva are de învățat un singur format,
 * indiferent dacă fișierul vine din repo sau de pe calculatorul adminului.
 *
 * Două lucruri pe care fișierul **nu** le conține, ca să nu se creadă altceva:
 *
 * - **conturile auth** (emailuri, parole) — deliberat, sunt în alt sistem;
 * - **fișierele din Storage** (atașamentele petițiilor, tabelele de
 *   statistică) — pe acelea le duce copia zilnică în repo; aici e doar baza.
 *
 * Citirea se face cu sesiunea adminului, deci RLS se aplică. Pentru
 * paisprezece tabele din cincisprezece adminul vede tot; excepția e
 * `notifications`, unde politica din migrarea 0008 dă fiecăruia doar rândurile
 * lui (`user_id = auth.uid()`), deci fișierul descărcat manual conține
 * notificările adminului, nu ale întregii echipe. Copia zilnică, făcută cu
 * cheia de serviciu, le are pe toate — de aceea ea rămâne copia de bază, iar
 * asta e scrisă și lângă buton.
 */

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { buildDump } from "@/lib/backup-dump";

export const dynamic = "force-dynamic";
// Cincisprezece tabele citite paginat, una după alta: pragul implicit de zece
// secunde e strâmt pe măsură ce datele cresc, iar o cerere omorâtă la mijloc
// n-ar da niciun fișier.
export const maxDuration = 60;

export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Neautentificat." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Doar adminul poate face backup." }, { status: 403 });
  }

  const now = new Date();
  let json: string;
  try {
    json = await buildDump(supabase, now);
  } catch (err) {
    // Un tabel căzut oprește descărcarea întreagă, nu dă un fișier fără el:
    // un backup cu o lipsă tăcută e mai rău decât un buton care spune „n-a
    // mers", fiindcă înlocuiește grija cu liniște falsă.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const date = now.toISOString().slice(0, 10);
  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="task-manager-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
