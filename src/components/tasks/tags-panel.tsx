"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTag } from "@/app/tasks/actions";
import { ManageTagsDialog } from "@/components/tasks/manage-tags-dialog";
import { cn } from "@/lib/utils";
import type { TaskFilter } from "@/lib/task-filters";
import type { Tag, Task } from "@/lib/types";

const DEFAULT_COLOR = "#64748b";

interface TagsPanelProps {
  allTags: Tag[];
  tasks: Task[];
  filter: TaskFilter;
  onFilterChange: (f: TaskFilter) => void;
  isAdmin: boolean;
}

export function TagsPanel({ allTags, tasks, filter, onFilterChange, isAdmin }: TagsPanelProps) {
  const router = useRouter();

  // Număr de sarcini per etichetă (total, din toate sarcinile).
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const tg of task.tags ?? []) {
      counts.set(tg.id, (counts.get(tg.id) ?? 0) + 1);
    }
  }
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);

  const toggle = (id: string) => {
    onFilterChange({ ...filter, tagId: filter.tagId === id ? undefined : id });
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Numele etichetei e obligatoriu.");
      return;
    }
    startTransition(async () => {
      const res = await createTag(trimmed, color);
      if (res.error || !res.tag) {
        toast.error(res.error ?? "Eroare la crearea etichetei.");
        return;
      }
      setName("");
      setColor(DEFAULT_COLOR);
      setCreating(false);
      toast.success("Etichetă creată");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Etichete</h2>
        {isAdmin && (
          <div className="flex items-center gap-1">
            {allTags.length > 0 && <ManageTagsDialog tags={allTags} />}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setCreating((v) => !v)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Adaugă
            </Button>
          </div>
        )}
      </div>

      {allTags.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nicio etichetă.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => {
            const active = filter.tagId === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition hover:opacity-80",
                  active && "font-medium text-white",
                )}
                style={
                  active
                    ? { backgroundColor: tag.color, borderColor: tag.color }
                    : { borderColor: tag.color, color: tag.color }
                }
              >
                {tag.name}
                <span className="ml-1.5 tabular-nums opacity-70">{counts.get(tag.id) ?? 0}</span>
              </button>
            );
          })}
        </div>
      )}

      {filter.tagId && (
        <button
          type="button"
          onClick={() => onFilterChange({ ...filter, tagId: undefined })}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3 w-3" /> Șterge filtrul de etichetă
        </button>
      )}

      {isAdmin && creating && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Etichetă nouă"
            className="h-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Culoare etichetă"
            className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
          />
          <Button size="sm" className="h-8" onClick={handleCreate} disabled={isPending}>
            OK
          </Button>
        </div>
      )}
    </div>
  );
}
