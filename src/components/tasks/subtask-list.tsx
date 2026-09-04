"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  applyTemplateSubtasks,
} from "@/app/tasks/actions";
import { templateStepsForTags } from "@/lib/subtask-templates";
import { cn } from "@/lib/utils";
import type { Subtask } from "@/lib/types";

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
  tagNames: string[];
  canEdit: boolean;
}

export function SubtaskList({ taskId, subtasks, tagNames, canEdit }: SubtaskListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newTitle, setNewTitle] = useState("");

  if (subtasks.length === 0 && !canEdit) return null;

  const total = subtasks.length;
  const doneCount = subtasks.filter((s) => s.done).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const templateAvailable = canEdit && templateStepsForTags(tagNames).length > 0;

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });

  const add = () => {
    const t = newTitle.trim();
    if (!t) return;
    run(async () => {
      const r = await addSubtask(taskId, t);
      if (!r.error) setNewTitle("");
      return r;
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pași{total > 0 ? ` (${doneCount}/${total})` : ""}
        </h2>
        {templateAvailable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={isPending}
            onClick={() => run(() => applyTemplateSubtasks(taskId))}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Pași standard
          </Button>
        )}
      </div>

      {total > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Niciun pas.</p>
      ) : (
        <ul className="space-y-1.5">
          {subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={s.done}
                disabled={!canEdit || isPending}
                onChange={(e) => run(() => toggleSubtask(s.id, taskId, e.target.checked))}
                className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-600"
                aria-label={s.title}
              />
              <span className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}>
                {s.title}
              </span>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Șterge pasul ${s.title}`}
                  disabled={isPending}
                  onClick={() => run(() => deleteSubtask(s.id, taskId))}
                  className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex items-center gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Adaugă un pas…"
            className="h-8"
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button size="sm" className="h-8" onClick={add} disabled={isPending}>
            Adaugă
          </Button>
        </div>
      )}
    </section>
  );
}
