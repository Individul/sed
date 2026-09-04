"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { taskSchema, type TaskInput } from "@/lib/schemas";
import { notify } from "@/lib/notify";
import { hasChanges } from "@/lib/changes";
import { templateStepsForTags, isDispatchStep, isResponseStep } from "@/lib/subtask-templates";

const STATUS_LABEL = {
  todo: "De făcut",
  in_progress: "În lucru",
  waiting: "În așteptare",
  done: "Finalizat",
} as const;

type ActionResult = { error?: string; success?: boolean };

function normalize(input: TaskInput) {
  return {
    title: input.title.trim(),
    description: input.description ? input.description : null,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date ? input.due_date : null,
    assignee_id: input.assignee_id ? input.assignee_id : null,
  };
}

/**
 * De când așteaptă sarcina. Contorul pornește la intrarea în stare și se
 * păstrează cât timp rămâne acolo — altfel fiecare salvare l-ar reseta și
 * așteptările lungi ar arăta veșnic ca proaspete.
 */
function waitingSince(
  nextStatus: TaskInput["status"],
  prevStatus?: string,
  prevSince?: string | null,
): string | null {
  if (nextStatus !== "waiting") return null;
  if (prevStatus === "waiting" && prevSince) return prevSince;
  return new Date().toISOString();
}

export async function createTask(input: TaskInput, tagIds: string[] = []): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Date invalide." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const nt = normalize(parsed.data);
  const { data: newTask, error } = await supabase
    .from("tasks")
    .insert({ ...nt, waiting_since: waitingSince(nt.status), created_by: userId })
    .select("id")
    .single();
  if (error || !newTask) return { error: error?.message ?? "Eroare la crearea sarcinii." };

  if (tagIds.length) {
    const rows = tagIds.map((tag_id) => ({ task_id: newTask.id as string, tag_id }));
    const { error: tagErr } = await supabase.from("task_tags").insert(rows);
    if (tagErr) return { error: tagErr.message };
  }

  // Șabloane: adaugă pașii standard pentru etichetele cu șablon (best-effort).
  await applyTemplateSubtasks(newTask.id as string);

  const created = {
    id: newTask.id as string,
    title: nt.title,
    assignee_id: nt.assignee_id,
    created_by: userId,
  };
  // Adminii află de orice sarcină nouă, chiar dacă autorul și-a atribuit-o singur.
  await notify("created", created, userId);
  if (nt.assignee_id) {
    // Adminii au primit deja „created" pentru aceeași acțiune — fără copie dublă.
    await notify("assigned", created, userId, undefined, false);
  }

  revalidatePath("/sarcini");
  revalidatePath("/");
  return { success: true };
}

export async function updateTask(
  id: string,
  input: TaskInput,
  tagIds: string[] = [],
): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Date invalide." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  // Rândul întreg: spune ce s-a schimbat și dacă s-a schimbat ceva.
  const { data: prev } = await supabase.from("tasks").select("*").eq("id", id).single();

  const nt = normalize(parsed.data);
  const payload = {
    ...nt,
    waiting_since: waitingSince(
      nt.status,
      prev?.status as string | undefined,
      prev?.waiting_since as string | null | undefined,
    ),
  };
  const { data, error } = await supabase.from("tasks").update(payload).eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Sarcină inexistentă sau fără permisiune." };

  // Sincronizează etichetele (adaugă cele noi, elimină cele deselectate).
  const { data: existing } = await supabase.from("task_tags").select("tag_id").eq("task_id", id);
  const current = new Set((existing ?? []).map((r) => r.tag_id as string));
  const toAdd = tagIds.filter((t) => !current.has(t));
  const toRemove = [...current].filter((t) => !tagIds.includes(t));
  if (toAdd.length) {
    const { error: addErr } = await supabase
      .from("task_tags")
      .insert(toAdd.map((tag_id) => ({ task_id: id, tag_id })));
    if (addErr) return { error: addErr.message };
  }
  if (toRemove.length) {
    const { error: remErr } = await supabase
      .from("task_tags")
      .delete()
      .eq("task_id", id)
      .in("tag_id", toRemove);
    if (remErr) return { error: remErr.message };
  }

  // Un „Salvează" care n-a schimbat nici câmpurile, nici etichetele, nu notifică.
  const touched = hasChanges(prev ?? {}, nt) || toAdd.length > 0 || toRemove.length > 0;
  if (prev && touched) {
    const task = { id, title: nt.title, assignee_id: nt.assignee_id, created_by: prev.created_by as string };
    if (nt.assignee_id && nt.assignee_id !== prev.assignee_id) await notify("assigned", task, userId);
    else if (nt.status !== prev.status) await notify("status", task, userId, STATUS_LABEL[nt.status]);
    else await notify("edited", task, userId);
  }

  revalidatePath("/sarcini");
  revalidatePath("/");
  revalidatePath(`/tasks/${id}`);
  return { success: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { data: prev } = await supabase
    .from("tasks")
    .select("title, assignee_id, created_by")
    .eq("id", id)
    .single();

  const { data, error } = await supabase.from("tasks").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Sarcină inexistentă sau fără permisiune." };

  if (prev) {
    await notify(
      "deleted",
      {
        id,
        title: prev.title as string,
        assignee_id: prev.assignee_id as string | null,
        created_by: prev.created_by as string,
      },
      userId,
    );
  }

  revalidatePath("/sarcini");
  revalidatePath("/");
  return { success: true };
}

// Marchează sarcina ca finalizată. Regula „proprie sau admin" e impusă de
// politica RLS `tasks update` (admin OR created_by OR assignee); dacă userul nu
// are drept, update-ul afectează 0 rânduri și întoarcem eroare.
export async function finalizeTask(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { data: prev } = await supabase
    .from("tasks")
    .select("title, assignee_id, created_by")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "done", waiting_since: null })
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Sarcină inexistentă sau fără permisiune." };

  if (prev) {
    await notify(
      "status",
      {
        id,
        title: prev.title as string,
        assignee_id: prev.assignee_id as string | null,
        created_by: prev.created_by as string,
      },
      userId,
      "Finalizat",
    );
  }

  revalidatePath("/sarcini");
  revalidatePath("/");
  revalidatePath(`/tasks/${id}`);
  return { success: true };
}

export async function createTag(name: string, color: string): Promise<{ error?: string; tag?: { id: string; name: string; color: string } }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Numele etichetei e obligatoriu." };
  const supabase = createClient();

  // Doar adminul poate crea etichete (impus și de RLS).
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") return { error: "Doar adminul poate crea etichete." };

  const { data, error } = await supabase
    .from("tags")
    .insert({ name: trimmed, color })
    .select()
    .single();
  if (error) {
    // Numele etichetelor sunt unice; ciocnirea e un caz așteptat, nu o eroare
    // de sistem — `updateTag` de mai jos o tratează deja la fel.
    if ((error as { code?: string }).code === "23505") {
      return { error: "Există deja o etichetă cu numele acesta." };
    }
    return { error: error.message };
  }
  return { tag: data as { id: string; name: string; color: string } };
}

export async function updateTag(
  id: string,
  name: string,
  color: string,
): Promise<{ error?: string; success?: boolean }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Numele etichetei e obligatoriu." };
  const supabase = createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") return { error: "Doar adminul poate modifica etichete." };

  const { data, error } = await supabase
    .from("tags")
    .update({ name: trimmed, color })
    .eq("id", id)
    .select();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: "Există deja o etichetă cu acest nume." };
    }
    return { error: error.message };
  }
  if (!data || data.length === 0) return { error: "Etichetă inexistentă sau fără permisiune." };
  revalidatePath("/sarcini");
  revalidatePath("/");
  return { success: true };
}

export async function deleteTag(id: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") return { error: "Doar adminul poate șterge etichete." };

  // task_tags are ON DELETE CASCADE → eticheta se elimină automat de pe sarcini.
  const { data, error } = await supabase.from("tags").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Etichetă inexistentă sau fără permisiune." };
  revalidatePath("/sarcini");
  revalidatePath("/");
  return { success: true };
}

export async function attachTag(taskId: string, tagId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient();
  const { error } = await supabase.from("task_tags").insert({ task_id: taskId, tag_id: tagId });
  // Dublu-click pe aceeași etichetă = ciocnire pe cheia primară. Starea dorită
  // — eticheta atașată — există deja, deci e o reușită, nu o eroare de arătat.
  if (error && (error as { code?: string }).code !== "23505") return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/sarcini");
  revalidatePath("/");
  return { success: true };
}

export async function detachTag(taskId: string, tagId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("task_tags")
    .delete()
    .eq("task_id", taskId)
    .eq("tag_id", tagId);
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/sarcini");
  revalidatePath("/");
  return { success: true };
}

export async function addComment(taskId: string, body: string): Promise<{ error?: string; success?: boolean }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Comentariul nu poate fi gol." };
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { error } = await supabase
    .from("comments")
    .insert({ task_id: taskId, author_id: userId, body: trimmed });
  if (error) return { error: error.message };

  const { data: t } = await supabase
    .from("tasks")
    .select("title, assignee_id, created_by")
    .eq("id", taskId)
    .single();
  if (t) {
    await notify(
      "comment",
      {
        id: taskId,
        title: t.title as string,
        assignee_id: t.assignee_id as string | null,
        created_by: t.created_by as string,
      },
      userId,
    );
  }

  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function editComment(commentId: string, taskId: string, body: string): Promise<{ error?: string; success?: boolean }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Comentariul nu poate fi gol." };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({ body: trimmed })
    .eq("id", commentId)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Comentariu inexistent sau fără permisiune." };
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function deleteComment(commentId: string, taskId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Comentariu inexistent sau fără permisiune." };
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

// ===== Pași (subtask-uri) =====

export async function addSubtask(taskId: string, title: string): Promise<{ error?: string }> {
  const trimmed = title.trim();
  if (!trimmed) return { error: "Pasul nu poate fi gol." };
  const supabase = createClient();
  const { data: last } = await supabase
    .from("subtasks")
    .select("position")
    .eq("task_id", taskId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number | undefined) ?? -1) + 1;
  const { error } = await supabase
    .from("subtasks")
    .insert({ task_id: taskId, title: trimmed, position });
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

export async function toggleSubtask(
  id: string,
  taskId: string,
  done: boolean,
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: updated, error } = await supabase
    .from("subtasks")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .select("title")
    .single();
  if (error) return { error: error.message };

  // Pașii mută singuri sarcina prin fluxul demersului: expediat → așteaptă
  // instanța (termenul nu mai curge), răspuns primit → gata.
  //
  // Erorile acestor mutări NU se înghit: pasul ar rămâne bifat, dar sarcina
  // nu s-ar mișca, iar cel care a bifat n-ar afla niciodată. Zero rânduri, în
  // schimb, e aici un deznodământ legitim — condițiile de stare (`neq`,
  // verificarea de dinainte) există tocmai ca mutarea să nu se aplice mereu.
  if (done && updated) {
    const title = updated.title as string;
    if (isResponseStep(title)) {
      const { error: moveError } = await supabase
        .from("tasks")
        .update({ status: "done", waiting_since: null })
        .eq("id", taskId)
        .neq("status", "done");
      if (moveError) {
        return { error: `Pasul e bifat, dar sarcina n-a putut fi finalizată: ${moveError.message}` };
      }
    } else if (isDispatchStep(title)) {
      // Doar dintr-o stare activă: o sarcină deja finalizată nu se redeschide.
      const { data: task } = await supabase
        .from("tasks")
        .select("status")
        .eq("id", taskId)
        .maybeSingle();
      if (task?.status === "todo" || task?.status === "in_progress") {
        const { error: moveError } = await supabase
          .from("tasks")
          .update({ status: "waiting", waiting_since: new Date().toISOString() })
          .eq("id", taskId);
        if (moveError) {
          return {
            error: `Pasul e bifat, dar sarcina n-a trecut în așteptare: ${moveError.message}`,
          };
        }
      }
    }
  }

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/sarcini");
  revalidatePath("/");
  return {};
}

export async function deleteSubtask(id: string, taskId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  // Singura ștergere din fișier pe care RLS o poate filtra CHIAR AZI: scrierea
  // pe subsarcini cere drept de editare pe sarcină. Fără `.select()`, un membru
  // fără drept primea „succes" iar pasul rămânea la locul lui.
  const { data, error } = await supabase.from("subtasks").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Pasul nu mai există sau nu ai dreptul să-l ștergi." };
  }
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

// Adaugă pașii standard (din șabloanele etichetelor sarcinii) care lipsesc.
export async function applyTemplateSubtasks(
  taskId: string,
): Promise<{ error?: string; added?: number }> {
  const supabase = createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("tags(name)")
    .eq("id", taskId)
    .maybeSingle();
  const tagNames = ((task?.tags as { name: string }[] | undefined) ?? []).map((t) => t.name);
  const steps = templateStepsForTags(tagNames);
  if (steps.length === 0) return { added: 0 };

  const { data: existing } = await supabase
    .from("subtasks")
    .select("title, position")
    .eq("task_id", taskId);
  const have = new Set(((existing ?? []) as { title: string }[]).map((s) => s.title));
  const toAdd = steps.filter((s) => !have.has(s));
  if (toAdd.length === 0) return { added: 0 };

  let position =
    ((existing ?? []) as { position: number }[]).reduce((m, s) => Math.max(m, s.position), -1) + 1;
  const rows = toAdd.map((title) => ({ task_id: taskId, title, position: position++ }));
  const { error } = await supabase.from("subtasks").insert(rows);
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { added: rows.length };
}
