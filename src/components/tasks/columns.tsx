"use client";

import Link from "next/link";
import { TASK_STATUS_LABEL } from "@/lib/status-labels";
import { format, parseISO } from "date-fns";
import { ArrowUpDown, CheckCircle2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Column, ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isTaskOverdue } from "@/lib/hub-stats";
import { PRIORITY_ORDER } from "@/lib/task-filters";
import { canEditTask, canDeleteTask, canFinalizeTask } from "@/lib/permissions";
import type { Task, TaskStatus, TaskPriority } from "@/lib/types";

// Numele vin din `@/lib/status-labels`, culorile rămân aici: numele se arată
// și în căutare, culorile nu.
const STATUS_CLASS: Record<TaskStatus, string> = {
  todo: "border-transparent bg-slate-100 text-slate-700",
  in_progress: "border-transparent bg-blue-100 text-blue-700",
  waiting: "border-transparent bg-violet-100 text-violet-700",
  done: "border-transparent bg-green-100 text-green-700",
};

export const STATUS_META: Record<TaskStatus, { label: string; className: string }> =
  Object.fromEntries(
    (Object.keys(STATUS_CLASS) as TaskStatus[]).map((k) => [
      k,
      { label: TASK_STATUS_LABEL[k], className: STATUS_CLASS[k] },
    ]),
  ) as Record<TaskStatus, { label: string; className: string }>;

export const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Scăzută", className: "border-transparent bg-slate-100 text-slate-700" },
  medium: { label: "Medie", className: "border-transparent bg-amber-100 text-amber-800" },
  high: { label: "Ridicată", className: "border-transparent bg-red-100 text-red-700" },
};

export const PRIORITY_BAR: Record<TaskPriority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-300",
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  waiting: "bg-violet-500",
  done: "bg-green-500",
};

// Ordinea de sortare a stărilor: De făcut → În lucru → Finalizat.
// Ordinea firească a lucrului: de făcut → în lucru → plecat la instanță → gata.
export const STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  waiting: 2,
  done: 3,
};

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Delegat, nu recalculat: cifra „restant" trebuie să fie una singură oriunde
// apare — card, filtru, celulă, detaliu. Pagina de detaliu a avut propria
// socoteală și a uitat scutirea pentru „în așteptare"; două numere care se
// contrazic pe același ecran sunt exact ce interzice delegarea asta.
export function isOverdue(task: Task): boolean {
  return isTaskOverdue(task);
}

/** De câte zile așteaptă sarcina răspuns extern; null dacă nu așteaptă. */
export function waitingDays(task: Task): number | null {
  if (task.status !== "waiting" || !task.waiting_since) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const since = new Date(task.waiting_since);
  const startOfSince = new Date(since.getFullYear(), since.getMonth(), since.getDate());
  return Math.max(0, Math.round((startOfToday.getTime() - startOfSince.getTime()) / 86_400_000));
}

function SortableHeader({ column, label }: { column: Column<Task, unknown>; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

export interface ColumnHandlers {
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onFinalize: (task: Task) => void;
  currentUserId: string | null;
  isAdmin: boolean;
}

export interface TaskActionsMenuProps {
  task: Task;
  currentUserId: string | null;
  isAdmin: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onFinalize: (task: Task) => void;
}

// Meniul de acțiuni pe sarcină, cu gating de rol identic în listă și în coloană.
export function TaskActionsMenu({
  task,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
  onFinalize,
}: TaskActionsMenuProps) {
  const uid = currentUserId ?? "";
  const canEdit = canEditTask(uid, isAdmin, task);
  const canDelete = canDeleteTask(uid, isAdmin, task);
  const canFinalize = canFinalizeTask(uid, isAdmin, task) && task.status !== "done";
  if (!canEdit && !canDelete && !canFinalize) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acțiuni</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canFinalize && (
          <DropdownMenuItem onSelect={() => onFinalize(task)}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Finalizează
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem onSelect={() => onEdit(task)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editează
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onDelete(task)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Șterge
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function makeColumns({
  onEdit,
  onDelete,
  onFinalize,
  currentUserId,
  isAdmin,
}: ColumnHandlers): ColumnDef<Task>[] {
  return [
  {
    id: "priority",
    accessorFn: (task) => PRIORITY_ORDER[task.priority],
    header: ({ column }) => <SortableHeader column={column} label="Prioritate" />,
    cell: ({ row }) => (
      <span
        aria-label={PRIORITY_META[row.original.priority].label}
        title={PRIORITY_META[row.original.priority].label}
        className={cn("block h-6 w-1 rounded-full", PRIORITY_BAR[row.original.priority])}
      />
    ),
  },
  {
    accessorKey: "title",
    header: "Sarcină",
    cell: ({ row }) => (
      <div className="space-y-1">
        <Link href={`/tasks/${row.original.id}`} className="font-medium hover:underline">
          {row.original.title}
        </Link>
        {(row.original.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {row.original.tags!.map((tag) => (
              <Badge
                key={tag.id}
                className="border-transparent text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    ),
  },
  {
    id: "status",
    accessorFn: (task) => STATUS_ORDER[task.status],
    header: ({ column }) => <SortableHeader column={column} label="Stare" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span
          className={cn("h-2 w-2 rounded-full", STATUS_DOT[row.original.status])}
          aria-hidden
        />
        <span className="text-sm text-muted-foreground">
          {STATUS_META[row.original.status].label}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "assignee",
    header: "Responsabil",
    enableSorting: false,
    cell: ({ row }) => {
      const assignee = row.original.assignee;
      if (!assignee) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">{initials(assignee.full_name)}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">{assignee.full_name ?? "—"}</span>
        </div>
      );
    },
  },
  {
    id: "due_date",
    // Fără termen → la coadă (sentinelă). ISO „yyyy-mm-dd" se sortează cronologic.
    accessorFn: (task) => task.due_date ?? "9999-12-31",
    header: ({ column }) => <SortableHeader column={column} label="Termen" />,
    cell: ({ row }) => {
      if (!row.original.due_date) return <span className="text-muted-foreground">—</span>;
      return (
        <span className={cn(isOverdue(row.original) && "text-red-600")}>
          {format(parseISO(row.original.due_date), "d MMM yyyy")}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <TaskActionsMenu
          task={row.original}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onEdit={onEdit}
          onDelete={onDelete}
          onFinalize={onFinalize}
        />
      </div>
    ),
  },
  ];
}
