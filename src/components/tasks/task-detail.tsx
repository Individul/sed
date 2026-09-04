"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TagPicker } from "@/components/tasks/tag-picker";
import { Comments } from "./comments";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { TaskHistory } from "@/components/tasks/task-history";
import { finalizeTask } from "@/app/tasks/actions";
import { isTaskOverdue } from "@/lib/hub-stats";
import { canEditTask, canFinalizeTask } from "@/lib/permissions";
import { avatarColor } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";
import type {
  AuditEntry,
  Comment,
  Profile,
  Subtask,
  Tag,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";

const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "De făcut", className: "border-transparent bg-slate-100 text-slate-700" },
  in_progress: { label: "În lucru", className: "border-transparent bg-blue-100 text-blue-700" },
  waiting: {
    label: "În așteptare",
    className: "border-transparent bg-violet-100 text-violet-700",
  },
  done: { label: "Finalizat", className: "border-transparent bg-green-100 text-green-700" },
};

const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Scăzută", className: "border-transparent bg-slate-100 text-slate-700" },
  medium: { label: "Medie", className: "border-transparent bg-amber-100 text-amber-800" },
  high: { label: "Ridicată", className: "border-transparent bg-red-100 text-red-700" },
};

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</dt>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</h2>
  );
}

interface TaskDetailProps {
  task: Task & { comments: Comment[] };
  profiles: Profile[];
  allTags: Tag[];
  history: AuditEntry[];
  subtasks: Subtask[];
  currentUserId: string | null;
  isAdmin: boolean;
}

export function TaskDetail({
  task,
  profiles,
  allTags,
  history,
  subtasks,
  currentUserId,
  isAdmin,
}: TaskDetailProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const status = STATUS_META[task.status];
  const priority = PRIORITY_META[task.priority];
  const assignee = task.assignee;
  const canEdit = canEditTask(currentUserId ?? "", isAdmin, task);
  const canFinalize =
    canFinalizeTask(currentUserId ?? "", isAdmin, task) && task.status !== "done";

  // Același predicat ca în listă, filtru și card — nu o socoteală proprie.
  // Varianta locală uita scutirea pentru „în așteptare": lista arăta data
  // neagră și zero restanțe, iar pagina asta o arăta roșie, la doi centimetri
  // sub insigna violetă „În așteptare".
  const overdue = isTaskOverdue(task);

  const handleFinalize = () => {
    startTransition(async () => {
      const res = await finalizeTask(task.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Sarcină finalizată");
      router.refresh();
    });
  };

  return (
    <article className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={status.className}>{status.label}</Badge>
            <Badge className={priority.className}>{priority.label}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canFinalize && (
            <Button size="sm" onClick={handleFinalize} disabled={isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizează
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editează
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* Panou lateral „Detalii" — primul în DOM (sus pe mobil), în dreapta pe desktop. */}
        <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6">
          <dl className="space-y-4 rounded-xl border bg-card p-5 text-sm">
            <div className="space-y-1.5">
              <FieldLabel>Responsabil</FieldLabel>
              <dd>
                {assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className={cn("text-[10px]", avatarColor(assignee.id))}>
                        {initials(assignee.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{assignee.full_name ?? "(fără nume)"}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Neatribuit</span>
                )}
              </dd>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Termen</FieldLabel>
              <dd className={cn(overdue && "font-medium text-red-600")}>
                {task.due_date ? (
                  format(parseISO(task.due_date), "d MMM yyyy")
                ) : (
                  <span className="text-muted-foreground">Fără termen</span>
                )}
              </dd>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Creat</FieldLabel>
              <dd>{format(parseISO(task.created_at), "d MMM yyyy")}</dd>
            </div>
          </dl>
        </aside>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
          <section className="space-y-2">
            <SectionLabel>Descriere</SectionLabel>
            {task.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{task.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Fără descriere</p>
            )}
          </section>

          <SubtaskList
            taskId={task.id}
            subtasks={subtasks}
            tagNames={(task.tags ?? []).map((t) => t.name)}
            canEdit={canEdit}
          />

          <section className="space-y-3">
            <SectionLabel>Etichete</SectionLabel>
            <TagPicker taskId={task.id} taskTags={task.tags ?? []} allTags={allTags} />
          </section>

          <Comments
            taskId={task.id}
            comments={task.comments}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />

          <TaskHistory entries={history} />
        </div>
      </div>

      <TaskFormDialog
        profiles={profiles}
        allTags={allTags}
        task={task}
        open={editOpen}
        onOpenChange={setEditOpen}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
    </article>
  );
}
