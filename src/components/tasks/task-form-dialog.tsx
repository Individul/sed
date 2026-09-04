"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTask, updateTask } from "@/app/tasks/actions";
import { canReassignTask } from "@/lib/permissions";
import { taskSchema, type TaskInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "@/components/tasks/meta";
import type { Profile, Tag, Task, TaskPriority, TaskStatus } from "@/lib/types";

const UNASSIGNED = "unassigned";

const DUE_SHORTCUTS = [
  { label: "1 zi", days: 1 },
  { label: "3 zile", days: 3 },
  { label: "5 zile", days: 5 },
  { label: "14 zile", days: 14 },
  { label: "30 zile", days: 30 },
];

function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface TaskFormDialogProps {
  profiles: Profile[];
  allTags: Tag[];
  task?: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  currentUserId: string | null;
}

function defaultValues(task: Task | undefined, canReassign: boolean, currentUserId: string | null): TaskInput {
  let assignee_id: string;
  if (task) {
    // On edit, preserve the existing assignee regardless of role.
    assignee_id = task.assignee_id ?? "";
  } else if (!canReassign) {
    // Members creating a task are auto-assigned to themselves.
    assignee_id = currentUserId ?? "";
  } else {
    assignee_id = "";
  }
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "todo",
    priority: task?.priority ?? "medium",
    due_date: task?.due_date ?? "",
    assignee_id,
  };
}

export function TaskFormDialog({
  profiles,
  allTags,
  task,
  open,
  onOpenChange,
  isAdmin,
  currentUserId,
}: TaskFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const isEdit = Boolean(task);
  const canReassign = canReassignTask(isAdmin);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: defaultValues(task, canReassign, currentUserId),
  });

  useEffect(() => {
    if (open) {
      reset(defaultValues(task, canReassign, currentUserId));
      setSelectedTagIds((task?.tags ?? []).map((t) => t.id));
    }
  }, [open, task, canReassign, currentUserId, reset]);

  const onSubmit = (values: TaskInput) => {
    startTransition(async () => {
      const result = task
        ? await updateTask(task.id, values, selectedTagIds)
        : await createTask(values, selectedTagIds);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sarcină salvată");
      if (!task) {
        reset(defaultValues(undefined, canReassign, currentUserId));
        setSelectedTagIds([]);
      }
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editează sarcina" : "Sarcină nouă"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Titlu</Label>
            <Input id="title" placeholder="Titlul sarcinii" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descriere</Label>
            <Textarea
              id="description"
              placeholder="Detalii (opțional)"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Stare</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Prioritate</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="due_date">Termen</Label>
              <Input id="due_date" type="date" {...register("due_date")} />
              <div className="flex flex-wrap gap-1.5">
                {DUE_SHORTCUTS.map((s) => {
                  const value = inDays(s.days);
                  const active = watch("due_date") === value;
                  return (
                    <button
                      key={s.days}
                      type="button"
                      onClick={() => setValue("due_date", value, { shouldDirty: true })}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs transition-colors",
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Responsabil</Label>
              <Controller
                control={control}
                name="assignee_id"
                render={({ field }) => (
                  <Select
                    value={field.value ? field.value : UNASSIGNED}
                    onValueChange={(v) => field.onChange(v === UNASSIGNED ? "" : v)}
                    disabled={!canReassign}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Neatribuit</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name ?? "(fără nume)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Etichete</Label>
            {allTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nu există etichete. Adminul le creează din pagina principală.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const active = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setSelectedTagIds((ids) =>
                          ids.includes(tag.id)
                            ? ids.filter((x) => x !== tag.id)
                            : [...ids, tag.id],
                        )
                      }
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs transition hover:opacity-80",
                        active && "font-medium text-white",
                      )}
                      style={
                        active
                          ? { backgroundColor: tag.color, borderColor: tag.color }
                          : { borderColor: tag.color, color: tag.color }
                      }
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Anulează
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Salvează" : "Creează"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
