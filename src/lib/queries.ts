import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type {
  Task,
  Profile,
  Tag,
  Comment,
  AuditEntry,
  Notification,
  Subtask,
  Petition,
  StatReport,
  StatValue,
  Transfer,
  Release,
} from "./types";
import type { Hearing } from "./hearings";
import type { TransferPlan } from "./transfer-plans";
import type { BackupRun } from "./backup";
import type { Obligation } from "./obligations";
import type { Defendant } from "./defendants";

export async function getTasks(): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!tasks_assignee_id_fkey(*), tags(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Task[];
}

/**
 * Coloanele din care pagina de start scoate cifrele sarcinilor: statisticile
 * cardului (`taskStats`) plus defalcarea pe responsabil (`groupByAssignee`).
 *
 * O singură listă, din care ies și tipul, și șirul cerut bazei de date. Scrise
 * separat, cele două ar fi putut ajunge să spună lucruri diferite — adică exact
 * defectul pe care îl repară toată schimbarea asta: un câmp pe care codul îl
 * citește, interogarea nu-l aduce, iar el sosește `undefined` la fiecare rulare,
 * tăcut. Derivate dintr-o listă, nu se mai pot contrazice, iar un nume de
 * coloană scris greșit nu trece de `Pick`: cade la compilare, nu în producție.
 */
const TASK_COUNT_COLUMNS = ["status", "due_date", "assignee_id"] as const;
export type TaskCountRow = Pick<Task, (typeof TASK_COUNT_COLUMNS)[number]>;

/**
 * Sarcinile reduse la ce se numără pe pagina de start.
 *
 * Nu înlocuiește `getTasks`: /sarcini afișează rândurile întregi, cu responsabil
 * și etichete. Aici nu se afișează niciun rând, doar se numără, iar responsabilul
 * încorporat și etichetele erau cea mai mare parte din răspuns. Drumul dus-întors
 * e oricum scurt (Supabase și funcția stau amândouă la Frankfurt) — se câștigă la
 * serializare și la `JSON.parse`, și mai ales la cum arată asta peste încă un an
 * de registru.
 *
 * Aceeași ordonare ca `getTasks`, deși nicio cifră n-o citește: gruparea pe
 * responsabil păstrează ordinea de intrare când două persoane au același număr
 * și același nume, deci ordinea identică scutește demonstrația că tabelul iese
 * la fel.
 */
export async function getTaskCounts(): Promise<TaskCountRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COUNT_COLUMNS.join(", "))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TaskCountRow[];
}

export async function getTask(id: string): Promise<(Task & { comments: Comment[] }) | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, assignee:profiles!tasks_assignee_id_fkey(*), tags(*), comments(*, author:profiles!comments_author_id_fkey(*))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // ordonează comentariile cronologic
  const task = data as unknown as Task & { comments: Comment[] };
  task.comments = (task.comments ?? []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return task;
}

export async function getTaskHistory(taskId: string): Promise<AuditEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("task_history", { p_task_id: taskId });
  // Grațios dacă migrarea 0009 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as AuditEntry[];
}

export async function getSubtasks(taskId: string): Promise<Subtask[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subtasks")
    .select("*")
    .eq("task_id", taskId)
    .order("position", { ascending: true });
  // Grațios dacă migrarea 0010 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as Subtask[];
}

export async function getProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("full_name");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function getTags(): Promise<Tag[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("tags").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function getAuditLog(
  limit = 100,
  /** Entitățile cerute; listă goală înseamnă tot jurnalul. */
  entities: AuditEntry["entity"][] = [],
): Promise<AuditEntry[]> {
  const supabase = createClient();
  // Filtrul intră în interogare: altfel un modul puțin activ ar părea gol doar
  // pentru că ultimele N intrări aparțin altuia.
  let query = supabase.from("audit_log").select("*");
  if (entities.length) query = query.in("entity", entities);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  // Tabela poate lipsi până se aplică migrarea 0007 — nu bloca pagina /admin.
  if (error) return [];
  return (data ?? []) as unknown as AuditEntry[];
}

/**
 * Profilul celui conectat.
 *
 * Învelit în `cache` din React: antetul stă acum în layout, iar unele pagini au
 * și ele nevoie de profil ca să știe dacă e admin. Fără învelișul acesta,
 * aceeași randare ar cere de două ori același lucru — și, mai scump, ar face de
 * două ori `getUser()`, care întreabă serverul Supabase prin rețea. `cache`
 * ține răspunsul cât ține o singură randare; între cereri nu păstrează nimic,
 * deci nimeni nu poate primi profilul altuia.
 */
/**
 * Identitatea celui conectat, sau `null`.
 *
 * Scoasă separat fiindcă antetul trebuie să atârne de sesiune, nu de profil:
 * un cont fără rând în `profiles` — se întâmplă la un utilizator abia creat —
 * ar rămâne altfel fără bară, deci și fără butonul de deconectare, adică fără
 * nicio ieșire.
 *
 * `cache` o face să coste un singur drum prin rețea pe randare, oricâți o cer:
 * `getUser()` întreabă serverul Supabase, nu citește doar cookie-ul.
 */
export const getCurrentUserId = cache(async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
});

export const getCurrentProfile = cache(async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Profile | null;
});

/** Ultimele înștiințări. Memorate pe durata randării, ca profilul de mai sus. */
export const getNotifications = cache(async function getNotifications(
  limit = 20,
): Promise<Notification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as Notification[];
});

/**
 * Petițiile pentru listă.
 *
 * Fără profilul responsabilului încorporat în fiecare rând. Măsurat pe datele
 * din producție: cele 348 de petiții cântăreau 320 KB la fiecare deschidere a
 * paginii, din care 67 erau chiar profilul acela — repetat de 348 de ori, deși
 * în total există patru profiluri, cu totul 717 octeți. Pagina cere oricum
 * lista lor separat, prin `getProfiles()`, deci lista își caută responsabilul
 * acolo. Aceleași 67 KB se economisesc și pe drumul către browser, iar
 * interogarea a scăzut de la 263 la 108 ms.
 *
 * `assignee_id` rămâne, fiindcă după el se filtrează și se face defalcarea.
 */
export async function getPetitions(): Promise<Petition[]> {
  const supabase = createClient();
  const base = "*";

  // Încercăm cu fișierele atașate; dacă migrarea 0013 nu e aplicată, relația
  // nu există și reluăm fără ea (lista trebuie să funcționeze oricum).
  const withFiles = await supabase
    .from("petitions")
    .select(`${base}, petition_attachments(id, path, name, kind)`)
    .order("response_deadline", { ascending: true });

  let rows = withFiles.data;
  if (withFiles.error) {
    const plain = await supabase
      .from("petitions")
      .select(base)
      .order("response_deadline", { ascending: true });
    // Grațios dacă migrarea 0012 nu e încă aplicată.
    if (plain.error) return [];
    rows = plain.data;
  }

  return (
    (rows ?? []) as unknown as (Petition & {
      petition_attachments?: NonNullable<Petition["attachments"]>;
    })[]
  ).map(({ petition_attachments: atts, ...p }) => ({
    ...p,
    // Scanarea petiției înaintea răspunsului: e cea căutată din listă.
    attachments: [...(atts ?? [])].sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === "petitie" ? -1 : 1,
    ),
  }));
}

/**
 * Ce citesc `petitionStats` și defalcarea pe responsabil — nimic altceva.
 * O listă, două întrebuințări; vezi `TASK_COUNT_COLUMNS` pentru de ce.
 */
const PETITION_COUNT_COLUMNS = ["status", "response_deadline", "assignee_id"] as const;
export type PetitionCountRow = Pick<Petition, (typeof PETITION_COUNT_COLUMNS)[number]>;

/**
 * Petițiile reduse la ce se numără pe pagina de start.
 *
 * Fără fișierele atașate și fără responsabilul încorporat: pagina de start nu
 * deschide nicio scanare și nu scrie niciun nume din rândul petiției. Registrul
 * are deja peste trei sute de petiții și crește cu fiecare lună, deci tocmai
 * aici se strânge costul.
 *
 * Eroarea nu se aruncă, la fel ca în `getPetitions`: dacă migrarea 0012 nu e
 * aplicată, tabela lipsește, iar pagina de start trebuie să se deschidă oricum —
 * cu zerouri, nu cu o eroare.
 */
export async function getPetitionCounts(): Promise<PetitionCountRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("petitions")
    .select(PETITION_COUNT_COLUMNS.join(", "))
    .order("response_deadline", { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as PetitionCountRow[];
}

/** Rândul brut cu relația încorporată; `stat_values` nu e o coloană. */
type StatReportRow = StatReport & { stat_values?: { id: string }[] };

/** Toate rapoartele, cele mai noi întâi, cu numărul de valori din fiecare. */
export async function getStatReports(): Promise<StatReport[]> {
  const supabase = createClient();

  // Încercăm cu valorile atașate; dacă migrarea 0016 nu e aplicată, relația nu
  // există și reluăm fără ea (pagina trebuie să funcționeze oricum).
  const withValues = await supabase
    .from("stat_reports")
    .select("*, stat_values(id)")
    .order("period_date", { ascending: false })
    .order("kind", { ascending: true });

  if (!withValues.error) {
    return ((withValues.data ?? []) as unknown as StatReportRow[]).map(
      ({ stat_values: values, ...report }) => ({ ...report, values_count: values?.length ?? 0 }),
    );
  }

  const plain = await supabase
    .from("stat_reports")
    .select("*")
    .order("period_date", { ascending: false })
    .order("kind", { ascending: true });
  // Grațios dacă nici tabela nu există încă.
  if (plain.error) return [];
  return ((plain.data ?? []) as unknown as StatReport[]).map((report) => ({
    ...report,
    values_count: 0,
  }));
}

/**
 * Rapoartele unui singur tip, cu valorile lor, în ordine cronologică — graficele
 * se citesc de la stânga la dreapta.
 */
export async function getStatValues(
  kind: string,
): Promise<{ report: StatReport; values: StatValue[] }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stat_reports")
    .select("*, stat_values(*)")
    .eq("kind", kind)
    .order("period_date", { ascending: true });
  // Grațios dacă migrarea 0016 nu e încă aplicată.
  if (error) return [];

  return ((data ?? []) as unknown as (StatReport & { stat_values?: StatValue[] })[]).map(
    ({ stat_values: values, ...report }) => {
      // `position` păstrează ordinea indicatorilor din fișierul-sursă.
      const sorted = [...(values ?? [])].sort((a, b) => a.position - b.position);
      return { report: { ...report, values_count: sorted.length }, values: sorted };
    },
  );
}

/** Câte înștiințări necitite. Memorată pe durata randării. */
export const getUnreadCount = cache(async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (error) return 0;
  return count ?? 0;
});

export async function getHearings(from: string, to: string): Promise<Hearing[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hearings")
    .select("*")
    .gte("session_date", from)
    .lte("session_date", to)
    .order("session_date", { ascending: false });
  // Grațios dacă migrarea 0018 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as Hearing[];
}

export async function getHearing(date: string): Promise<Hearing | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hearings")
    .select("*")
    .eq("session_date", date)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as Hearing | null;
}

/**
 * Registrul eliberărilor, cu tot cu răspunsul la întrebarea „a putut fi citit?".
 *
 * Nu doar rândurile, fiindcă lista goală ar fi ambiguă. Fără migrarea 0026
 * tabela nu există, interogarea cade, iar zero rânduri s-ar aduna în
 * `eliberati: 0` — o cifră care arată exact ca o săptămână în care n-a ieșit
 * nimeni. Celelalte trei cifre ale raportului ar fi corecte, deci nimănui nu
 * i-ar trece prin cap să se îndoiască tocmai de a patra: un zero convingător e
 * mai rău decât o pagină căzută, fiindcă ajunge tipărit.
 *
 * Eroarea tot nu se aruncă — cele trei cifre bune trebuie văzute — dar
 * `available: false` obligă pagina să scrie „—" în loc de „0" și să spună de ce.
 */
export interface ReleaseRegistry {
  rows: Release[];
  /** Fals doar dacă interogarea a eșuat; o săptămână fără eliberări e `[]` cu `true`. */
  available: boolean;
}

/** Eliberările din interval, zilele noi întâi — ca la ședințe. */
export async function getReleases(from: string, to: string): Promise<ReleaseRegistry> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("*")
    .gte("release_date", from)
    .lte("release_date", to)
    .order("release_date", { ascending: false });
  if (error) return { rows: [], available: false };
  return { rows: (data ?? []) as unknown as Release[], available: true };
}

/**
 * Registrul întreg, zilele noi întâi, iar în aceeași zi penitenciarele în ordine
 * crescătoare — ordinea în care le caută cineva care citește ziua.
 *
 * Eroarea nu se citește: dacă migrarea 0020 nu e încă aplicată, `data` e null și
 * pagina se deschide goală în loc să crape.
 */
export async function getTransfers(): Promise<Transfer[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("transfers")
    .select("*")
    .order("transfer_date", { ascending: false })
    .order("institution", { ascending: true });
  return (data ?? []) as unknown as Transfer[];
}

/**
 * Ce citesc banda de transferuri și filtrul de lună — `aggregate` și
 * `byInstitution`. O listă, două întrebuințări; vezi `TASK_COUNT_COLUMNS`.
 */
const TRANSFER_COUNT_COLUMNS = ["transfer_date", "institution", "plecati", "sositi"] as const;
export type TransferCountRow = Pick<Transfer, (typeof TRANSFER_COUNT_COLUMNS)[number]>;

/**
 * Transferurile reduse la ce se numără pe pagina de start.
 *
 * `total` lipsește deși e coloană în baza de date: `aggregate` îl recalculează
 * din plecați și sosiți, deci ar fi al treilea număr adus ca să fie ignorat.
 *
 * Eroarea nu se citește, la fel ca în `getTransfers`: fără migrarea 0020 banda
 * rămâne goală în loc să rupă pagina.
 */
export async function getTransferCounts(): Promise<TransferCountRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("transfers")
    .select(TRANSFER_COUNT_COLUMNS.join(", "))
    .order("transfer_date", { ascending: false })
    .order("institution", { ascending: true });
  return (data ?? []) as unknown as TransferCountRow[];
}

/**
 * Ultima rulare a copiei automate și ultima care a reușit.
 *
 * Două rânduri, nu unul, fiindcă sunt două întrebări diferite: când a reușit
 * ultima copie și dacă ultima încercare a căzut. Se pot suprapune — când
 * ultima rulare a și reușit, e același rând — dar de obicei nu, iar tocmai
 * nepotrivirea lor spune ce se întâmplă.
 *
 * Nu se citesc ultimele N rânduri ca să se caute reușita între ele: dacă
 * backupul e stricat de o lună, reușita e la treizeci de rânduri în urmă și
 * n-ar fi în felie. Interogarea filtrată o găsește oricât de departe ar fi,
 * pe indexul de `started_at`.
 *
 * Eroarea nu se aruncă: dacă migrarea 0022 nu e încă aplicată, tabela lipsește
 * și pagina de administrare trebuie să se deschidă oricum. Rezultatul — două
 * `null` — se citește ca „n-a rulat niciodată", ceea ce e și adevărat: fără
 * tabelă, ruta n-are unde scrie o rulare.
 */
export async function getLastBackupRun(): Promise<{
  last: BackupRun | null;
  lastSuccess: BackupRun | null;
}> {
  const supabase = createClient();
  const columns = "started_at, finished_at, ok, files_uploaded, files_pending, error";

  const [last, lastSuccess] = await Promise.all([
    supabase
      .from("backup_runs")
      .select(columns)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("backup_runs")
      .select(columns)
      .eq("ok", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    last: (last.data ?? null) as BackupRun | null,
    lastSuccess: (lastSuccess.data ?? null) as BackupRun | null,
  };
}

export async function getTransferPlans(): Promise<TransferPlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transfer_plans")
    .select("*")
    .order("hearing_date", { ascending: true });
  // Grațios dacă migrarea 0021 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as TransferPlan[];
}

/** Obligațiile active, cu termenele deja bifate — starea se calculează în cod. */
export async function getObligations(): Promise<{
  obligations: Obligation[];
  completed: Map<string, Set<string>>;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("obligations")
    .select("*")
    .eq("active", true)
    .order("position");
  // Grațios dacă migrarea 0023 nu e încă aplicată.
  if (error) return { obligations: [], completed: new Map() };

  const { data: done } = await supabase
    .from("obligation_completions")
    .select("obligation_id, due_date");

  const completed = new Map<string, Set<string>>();
  for (const row of done ?? []) {
    const key = row.obligation_id as string;
    const set = completed.get(key) ?? new Set<string>();
    set.add(row.due_date as string);
    completed.set(key, set);
  }

  return { obligations: (data ?? []) as unknown as Obligation[], completed };
}

export async function getDefendants(): Promise<Defendant[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("defendants")
    .select("*")
    .order("last_name");
  // Grațios dacă migrarea 0025 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as Defendant[];
}
