"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStatValues } from "@/lib/queries";
import { readGrid } from "@/lib/stats/workbook";
import { PARSERS, detectParser, parserFor } from "@/lib/stats/registry";
import { guessPeriod, type PeriodGuess, type PeriodType } from "@/lib/stats/period";
import type { Grid, StatItem, StatKind, StatParser, StatSeries } from "@/lib/stats/types";

type Result = { error?: string; success?: boolean };

type ServerClient = ReturnType<typeof createClient>;

const BUCKET = "statistics";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_XLSX_BYTES = 10 * 1024 * 1024; // 10 MB, cât acceptă și bucketul.
const ONLY_ADMIN = "Doar adminul poate importa statistici.";

/**
 * Rezultatul previzualizării: eroare **sau** raportul citit. Se despart cu
 * `"error" in res`. Nimic nu se salvează în această etapă.
 */
export interface StatPreview {
  kind: StatKind;
  kindLabel: string;
  /** Cât de sigur e parserul ales (0..1); `0` când tipul a fost impus. */
  score: number;
  /** Tipul a fost ales de om, nu recunoscut automat — `score` nu spune nimic. */
  forced: boolean;
  /** Perioada ghicită din numele fișierului; `null` dacă n-am găsit-o. */
  suggested: PeriodGuess | null;
  items: StatItem[];
  fileName: string;
  fileSize: number;
  /** Există deja un raport pentru (tip, perioadă) — importul îl va înlocui. */
  existing: boolean;
}

export type PreviewResult = { error: string } | StatPreview;

export interface SaveImportInput {
  kind: StatKind;
  periodDate: string;
  periodType: PeriodType;
  fileName: string;
  /** Fișierul .xlsx în base64 (se acceptă și forma `data:...;base64,`). */
  fileBase64: string;
  items: StatItem[];
}

/** Rândul din `stat_reports` de care avem nevoie ca să curățăm sursa veche. */
interface ReportRow {
  id: string;
  file_path: string | null;
  file_name: string | null;
}

/** Valoare gata de inserat; `report_id` se știe abia după upsert. */
interface PendingValue {
  indicator: string;
  series: StatSeries;
  value: number | null;
  position: number;
}

/**
 * Apelantul trebuie să fie admin: datele de raportare instituțională se scriu
 * într-un singur loc. Verificarea e o curtoazie pentru interfață — gardianul
 * real rămâne RLS (`is_admin()`), care se aplică și dacă acțiunea e apelată
 * direct.
 */
async function requireAdmin(
  supabase: ServerClient,
  denied: string,
): Promise<{ userId: string } | { error: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") return { error: denied };
  return { userId };
}

/** `aaaa-ll-zz` și zi care chiar există (2026-02-30 → false). */
function isIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

function isSeries(value: unknown): value is StatSeries {
  return value === "cumulat" || value === "perioada";
}

/** Șterge obiectul urcat adineauri; eșecul lui nu mai are ce salva. */
async function removeObject(supabase: ServerClient, path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * Există deja un raport pentru (tip, perioadă)? Doar pentru avertismentul din
 * interfață — importul înlocuiește oricum, corect, prin `upsert`. E o citire,
 * deci fără poartă de admin; RLS lasă orice utilizator autentificat să vadă
 * rapoartele. Dacă migrarea 0016 nu e aplicată, interogarea eșuează și
 * răspunsul rămâne `false`.
 */
export async function reportExists(
  kind: StatKind,
  periodDate: string,
  periodType: PeriodType,
): Promise<boolean> {
  if (!isIsoDate(periodDate)) return false;
  const supabase = createClient();
  const { data } = await supabase
    .from("stat_reports")
    .select("id")
    .eq("kind", kind)
    .eq("period_date", periodDate)
    .eq("period_type", periodType)
    .maybeSingle();
  return Boolean(data);
}

export async function previewImport(formData: FormData): Promise<PreviewResult> {
  const supabase = createClient();
  const admin = await requireAdmin(supabase, ONLY_ADMIN);
  if ("error" in admin) return { error: admin.error };

  // `FormDataEntryValue` e `File | string`; ce nu e string e fișier.
  const file = formData.get("file");
  if (!file || typeof file === "string") return { error: "Nu am primit niciun fișier." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: "Sunt acceptate doar fișiere .xlsx." };
  }
  if (file.size <= 0) return { error: "Fișierul e gol." };
  if (file.size > MAX_XLSX_BYTES) return { error: "Fișierul depășește 10 MB." };

  /*
   * Tipul impus de utilizator, când recunoașterea automată a dat greș. Fără el
   * un raport sosit într-o formă puțin schimbată ar fi o fundătură: parserul
   * nu e altfel un parametru al citirii. Îl rezolvăm înainte de a deschide
   * fișierul — un nume necunoscut nu merită osteneala de a citi 10 MB.
   */
  const requested = formData.get("kind");
  const forcedKind = typeof requested === "string" ? requested.trim() : "";
  let forced: StatParser | null = null;
  if (forcedKind !== "") {
    forced = PARSERS.find((parser) => parser.kind === forcedKind) ?? null;
    if (!forced) return { error: "Tip de raport necunoscut." };
  }

  let grid: Grid;
  try {
    grid = await readGrid(await file.arrayBuffer());
  } catch {
    // Mesajele exceljs sunt tehnice și în engleză — nu le dăm mai departe.
    return { error: "Nu am putut citi fișierul .xlsx. Verifică dacă e un Excel valid cu date." };
  }

  let parser: StatParser;
  let score: number;
  if (forced) {
    parser = forced;
    // Nimeni n-a măsurat nimic: potrivirea a fost afirmată, nu calculată.
    score = 0;
  } else {
    const match = detectParser(grid);
    if (!match) return { error: "Nu am recunoscut tipul de raport. Verifică fișierul." };
    parser = match.parser;
    score = match.score;
  }

  let items: StatItem[];
  try {
    // Parserul impus care nu-și găsește reperul aruncă propriul mesaj („nu
    // găsesc coloana P-6"…) — exact ce trebuie auzit: fișierul chiar nu e de
    // tipul ales.
    items = parser.parse(grid);
  } catch (err) {
    // Parserele aruncă mesaje gata scrise pentru utilizator.
    return { error: err instanceof Error ? err.message : "Nu am putut citi datele din fișier." };
  }
  if (items.length === 0) return { error: "Nu am găsit niciun indicator în fișier." };

  const suggested = guessPeriod(file.name);

  // Doar informativ, ca interfața să anunțe înlocuirea din capul locului;
  // dialogul reia verificarea când omul schimbă data sau tipul perioadei.
  const existing = suggested
    ? await reportExists(parser.kind, suggested.date, suggested.type)
    : false;

  return {
    kind: parser.kind,
    kindLabel: parser.label,
    score,
    forced: forced !== null,
    suggested,
    items,
    fileName: file.name,
    fileSize: file.size,
    existing,
  };
}

/**
 * Salvează raportul: urcă sursa .xlsx, scrie (sau înlocuiește) rândul perioadei
 * și rescrie complet valorile. Un import repetat pe aceeași perioadă e o
 * înlocuire, nu un duplicat.
 */
export async function saveImport(input: SaveImportInput): Promise<Result> {
  const supabase = createClient();
  const admin = await requireAdmin(supabase, ONLY_ADMIN);
  if ("error" in admin) return { error: admin.error };

  if (!parserFor(input.kind)) return { error: "Tip de raport necunoscut." };
  if (!isIsoDate(input.periodDate)) return { error: "Data perioadei e invalidă (aaaa-ll-zz)." };
  if (input.periodType !== "saptamanal" && input.periodType !== "lunar") {
    return { error: "Tipul perioadei e invalid." };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { error: "Nu există date de salvat." };
  }

  // Validăm tot înainte de a urca ceva: așa nu ajungem să anulăm un upload.
  const values: PendingValue[] = [];
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const indicator = typeof item?.indicator === "string" ? item.indicator.trim() : "";
    if (!indicator) return { error: "Un indicator a rămas fără nume." };
    if (!isSeries(item.series)) return { error: `Serie invalidă la „${indicator}".` };
    // Payloadul vine de la client, deci îl tratăm ca necunoscut, nu ca `StatItem`.
    const raw: unknown = item.value;
    let value: number | null;
    if (raw === null || raw === undefined) value = null;
    else if (typeof raw === "number" && Number.isFinite(raw)) value = raw;
    else return { error: `Valoare numerică invalidă la „${indicator}".` };
    values.push({ indicator, series: item.series, value, position: i });
  }

  // `data:...;base64,` apare când fișierul vine dintr-un FileReader.
  const base64 = String(input.fileBase64 ?? "").replace(/^data:[^;,]*;base64,/, "");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return { error: "Fișierul e gol." };
  if (bytes.length > MAX_XLSX_BYTES) return { error: "Fișierul depășește 10 MB." };

  // Sursa veche a perioadei, citită înainte de orice scriere: după upsert nu o
  // mai putem afla, iar fără ea am lăsa obiectul precedent orfan în bucket.
  const { data: previousData } = await supabase
    .from("stat_reports")
    .select("id, file_path, file_name")
    .eq("kind", input.kind)
    .eq("period_date", input.periodDate)
    .eq("period_type", input.periodType)
    .maybeSingle();
  const previous = (previousData ?? null) as ReportRow | null;

  const path = `${input.kind}/${input.periodDate}-${crypto.randomUUID()}.xlsx`;
  // Fără `upsert`: bucketul n-are politică de `update`, iar calea e unică.
  const uploaded = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: XLSX_MIME });
  if (uploaded.error) return { error: uploaded.error.message };

  /**
   * Curățenie după orice eșec de la upload încolo: obiectul proaspăt urcat
   * dispare (nimic orfan în bucket), iar rândul revine la sursa lui veche — sau
   * e șters cu totul, dacă l-am creat chiar acum. Valorile deja șterse nu se mai
   * pot învia, dar rândul rămâne coerent și un import repetat le pune la loc.
   */
  const rollback = async (reportId: string | null): Promise<void> => {
    await removeObject(supabase, path);
    if (!reportId) return;
    if (previous) {
      await supabase
        .from("stat_reports")
        .update({ file_path: previous.file_path, file_name: previous.file_name })
        .eq("id", reportId);
    } else {
      // Rând nou → îl scoatem cu totul (valorile pică prin cascadă).
      await supabase.from("stat_reports").delete().eq("id", reportId);
    }
  };

  const upserted = await supabase
    .from("stat_reports")
    .upsert(
      {
        kind: input.kind,
        period_date: input.periodDate,
        period_type: input.periodType,
        file_name: input.fileName,
        file_path: path,
        uploaded_by: admin.userId,
      },
      { onConflict: "kind,period_date,period_type" },
    )
    .select("id");
  if (upserted.error) {
    await rollback(null);
    return { error: upserted.error.message };
  }
  const reportId = ((upserted.data ?? []) as { id: string }[])[0]?.id ?? null;
  if (!reportId) {
    await rollback(null);
    return { error: "Raportul nu a putut fi salvat (fără permisiune?)." };
  }

  // Rescriere completă: perioada are exact indicatorii din fișierul de acum.
  const cleared = await supabase.from("stat_values").delete().eq("report_id", reportId);
  if (cleared.error) {
    await rollback(reportId);
    return { error: cleared.error.message };
  }

  const inserted = await supabase
    .from("stat_values")
    .insert(values.map((v) => ({ ...v, report_id: reportId })));
  if (inserted.error) {
    await rollback(reportId);
    return { error: inserted.error.message };
  }

  // Sursa înlocuită: o scoatem doar dacă e chiar alta (`file_path` n-are
  // constrângere de unicitate, deci nu ștergem o cale încă folosită).
  if (previous?.file_path && previous.file_path !== path) {
    await removeObject(supabase, previous.file_path);
  }

  revalidatePath("/statistici");
  return { success: true };
}

export async function deleteReport(id: string): Promise<Result> {
  const supabase = createClient();
  const admin = await requireAdmin(supabase, "Doar adminul poate șterge rapoarte.");
  if ("error" in admin) return { error: admin.error };
  if (!id) return { error: "Raport inexistent sau fără permisiune." };

  const { data: rowData } = await supabase
    .from("stat_reports")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  const row = (rowData ?? null) as Pick<ReportRow, "file_path"> | null;

  const { data, error } = await supabase.from("stat_reports").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Raport inexistent sau fără permisiune." };

  // Rândul a dispărut (valorile prin cascadă) → scoatem și sursa, fără orfani.
  if (row?.file_path) await removeObject(supabase, row.file_path);

  revalidatePath("/statistici");
  return { success: true };
}

/** O perioadă din seria unui tip de raport, cu indicatorii ei. */
export interface SeriesPeriod {
  reportId: string;
  periodDate: string;
  periodType: PeriodType;
  values: { indicator: string; series: StatSeries; value: number | null }[];
}

/**
 * Seria unui singur tip de raport, în ordine cronologică. E o citire, deci n-are
 * poartă de admin: RLS lasă orice utilizator autentificat să vadă statisticile.
 * Se încarcă la cerere, ca pagina să nu ducă din start valorile tuturor tipurilor.
 */
export async function listSeries(kind: string): Promise<SeriesPeriod[]> {
  if (!parserFor(kind as StatKind)) return [];
  const rows = await getStatValues(kind);
  return rows.map(({ report, values }) => ({
    reportId: report.id,
    periodDate: report.period_date,
    periodType: report.period_type,
    // Doar câmpurile de care are nevoie graficul — `id`/`report_id` ar umfla
    // degeaba payloadul trimis către client.
    values: values.map((v) => ({ indicator: v.indicator, series: v.series, value: v.value })),
  }));
}

/** Link semnat, valabil 60 de secunde, pentru descărcarea fișierului-sursă. */
export async function getStatFileUrl(
  path: string,
  downloadAs?: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60, downloadAs ? { download: downloadAs } : undefined);
  if (error || !data?.signedUrl) return { error: error?.message ?? "Nu s-a putut genera linkul." };
  return { url: data.signedUrl };
}
