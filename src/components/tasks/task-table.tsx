"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type Table as ReactTable,
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  makeColumns,
  TaskActionsMenu,
  STATUS_META,
  STATUS_DOT,
  PRIORITY_META,
  PRIORITY_BAR,
  initials,
  isOverdue,
  waitingDays,
} from "@/components/tasks/columns";
import { TaskFiltersBar } from "@/components/tasks/task-filters-bar";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { deleteTask, finalizeTask } from "@/app/tasks/actions";
import { filterTasks, type TaskFilter } from "@/lib/task-filters";
import { avatarColor } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";
import type { Profile, Tag, Task } from "@/lib/types";

interface TaskTableProps {
  tasks: Task[];
  profiles: Profile[];
  allTags: Tag[];
  currentUserId: string | null;
  isAdmin: boolean;
  filter: TaskFilter;
  onFilterChange: (f: TaskFilter) => void;
}

// Buton de sortare din antet: reflectă felul în care `SortableHeader`
// comută sortarea coloanei TanStack (asc → desc), fără a folosi flexRender.
function HeaderSortButton({
  table,
  columnId,
  label,
  className,
}: {
  table: ReactTable<Task>;
  columnId: string;
  label: string;
  className?: string;
}) {
  const column = table.getColumn(columnId);
  // `getIsSorted()` întoarce false | "asc" | "desc" — îl folosim ca să arătăm
  // direcția curentă și să evidențiem coloana activă.
  const active = column?.getIsSorted() ?? false;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      title={
        active
          ? `Sortat după ${label} (${active === "asc" ? "crescător" : "descrescător"})`
          : `Sortează după ${label}`
      }
      onClick={() => column?.toggleSorting(column.getIsSorted() === "asc")}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        active && "font-medium text-foreground",
        className,
      )}
    >
      {label}
      <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-60")} />
    </button>
  );
}

export function TaskTable({
  tasks,
  profiles,
  allTags,
  currentUserId,
  isAdmin,
  filter,
  onFilterChange,
}: TaskTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "status", desc: false },
    { id: "due_date", desc: false },
  ]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [, startTransition] = useTransition();

  const data = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

  // Lista poate fi goală pentru că nu există sarcini sau pentru că filtrele le
  // ascund — inclusiv filtrul implicit „doar ale mele" al membrilor.
  const filtersActive = Boolean(
    filter.search || filter.status || filter.assigneeId || filter.priority || filter.due || filter.tagId,
  );

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleDelete = (task: Task) => {
    if (!window.confirm("Ștergi această sarcină?")) return;
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sarcină ștearsă");
    });
  };

  const handleFinalize = (task: Task) => {
    startTransition(async () => {
      const result = await finalizeTask(task.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sarcină finalizată");
    });
  };

  // makeColumns rămâne sursa pentru instanța de tabel (sortare); corpul e
  // randat ca DIV-uri custom, deci celulele/anteturile nu mai trec prin flexRender.
  const columns = useMemo(
    () =>
      makeColumns({
        onEdit: handleEdit,
        onDelete: handleDelete,
        onFinalize: handleFinalize,
        currentUserId,
        isAdmin,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, isAdmin],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div>
      <TaskFiltersBar
        profiles={profiles}
        currentUserId={currentUserId}
        filter={filter}
        onFilterChange={onFilterChange}
        onNewTask={() => {
          setEditingTask(undefined);
          setFormOpen(true);
        }}
      />

      {/* Aceeași plasă ca la petiții: coloanele fixe fac 480px, iar titlul cu
          etichetele lui are nevoie de vreo 240 — deci 720. */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        {/* Antet */}
        <div className="flex min-w-[720px] items-stretch border-b bg-muted/30">
          <span className="w-1 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2 text-[11px] font-medium text-muted-foreground">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span>Sarcină</span>
              <HeaderSortButton
                table={table}
                columnId="priority"
                label="Prioritate"
                className="ml-auto shrink-0 pl-2"
              />
            </div>
            <HeaderSortButton
              table={table}
              columnId="status"
              label="Stare"
              className="w-28 shrink-0"
            />
            <span className="w-40 shrink-0">Responsabil</span>
            <HeaderSortButton
              table={table}
              columnId="due_date"
              label="Termen"
              className="w-24 shrink-0"
            />
            <span className="w-8 shrink-0" aria-hidden />
          </div>
        </div>

        {/* Rânduri */}
        {rows.length ? (
          <div className="min-w-[720px] divide-y">
            {rows.map((row) => {
              const t = row.original;
              return (
                <div
                  key={row.id}
                  onClick={() => router.push(`/tasks/${t.id}`)}
                  className="flex cursor-pointer items-stretch transition-colors hover:bg-muted/50"
                >
                  <span
                    aria-label={PRIORITY_META[t.priority].label}
                    title={PRIORITY_META[t.priority].label}
                    className={cn("w-1 shrink-0", PRIORITY_BAR[t.priority])}
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2">
                    {/* Sarcină */}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Link
                        href={`/tasks/${t.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {t.title}
                      </Link>
                      {(t.tags ?? []).length > 0 && (
                        <div className="flex shrink-0 items-center gap-2">
                          {t.tags!.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Stare — la așteptare arată și de cât timp durează, ca
                        oprirea termenului să nu ascundă dosarele uitate. */}
                    <div className="flex w-28 shrink-0 items-center gap-2">
                      <span
                        className={cn("h-2 w-2 rounded-full", STATUS_DOT[t.status])}
                        aria-hidden
                      />
                      <span className="min-w-0 text-[13px] text-muted-foreground">
                        <span className="block truncate">{STATUS_META[t.status].label}</span>
                        {waitingDays(t) !== null && (
                          <span className="block text-[11px] text-muted-foreground/70">
                            de {waitingDays(t)} zile
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Responsabil */}
                    <div className="flex w-40 min-w-0 shrink-0 items-center gap-2">
                      {t.assignee ? (
                        <>
                          <Avatar className="h-6 w-6">
                            <AvatarFallback
                              className={cn("text-[10px]", avatarColor(t.assignee.id))}
                            >
                              {initials(t.assignee.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-[13px]">
                            {t.assignee.full_name ?? "—"}
                          </span>
                        </>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">Neatribuit</span>
                      )}
                    </div>

                    {/* Termen */}
                    <div className="w-24 shrink-0 text-[13px]">
                      {t.due_date ? (
                        <span className={cn(isOverdue(t) && "text-red-600")}>
                          {format(parseISO(t.due_date), "d MMM yyyy")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Acțiuni */}
                    <div
                      className="flex w-8 shrink-0 justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TaskActionsMenu
                        task={t}
                        currentUserId={currentUserId}
                        isAdmin={isAdmin}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onFinalize={handleFinalize}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-muted-foreground">
            {filtersActive ? "Nicio sarcină găsită." : "Nicio sarcină."}
          </div>
        )}
      </div>

      <TaskFormDialog
        profiles={profiles}
        allTags={allTags}
        task={editingTask}
        open={formOpen}
        onOpenChange={setFormOpen}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
    </div>
  );
}
