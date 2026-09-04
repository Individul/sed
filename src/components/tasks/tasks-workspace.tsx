"use client";

import { useState } from "react";

import { QuickViews } from "@/components/tasks/quick-views";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskSummary } from "@/components/tasks/task-summary";
import { AssigneeBreakdown } from "@/components/tasks/assignee-breakdown";
import { TagsPanel } from "@/components/tasks/tags-panel";
import type { TaskFilter } from "@/lib/task-filters";
import type { Profile, Tag, Task } from "@/lib/types";

interface TasksWorkspaceProps {
  tasks: Task[];
  profiles: Profile[];
  allTags: Tag[];
  currentUserId: string | null;
  isAdmin: boolean;
}

export function TasksWorkspace({
  tasks,
  profiles,
  allTags,
  currentUserId,
  isAdmin,
}: TasksWorkspaceProps) {
  // Membrul deschide lista pe sarcinile lui — altfel caută printre ale tuturor.
  // Adminul o deschide completă: rolul lui e să vadă ce face echipa.
  const [filter, setFilter] = useState<TaskFilter>(
    isAdmin || !currentUserId ? {} : { assigneeId: currentUserId },
  );
  // Membrii văd rezumatul propriilor sarcini; adminul vede totalul + per utilizator.
  const summaryTasks = isAdmin ? tasks : tasks.filter((t) => t.assignee_id === currentUserId);

  // Aceleași praguri ca la petiții, din aceeași socoteală — vezi
  // petitions-workspace. Tabelul de sarcini e mai îngust (n-are „Petiționar” și
  // „Obiect”), deci se înghesuia mai puțin, dar se înghesuia.
  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
      <aside className="xl:w-56 xl:shrink-0">
        <QuickViews
          tasks={tasks}
          currentUserId={currentUserId}
          filter={filter}
          onFilterChange={setFilter}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6 min-[1700px]:flex-row min-[1700px]:items-start min-[1700px]:gap-8">
        <div className="min-w-0 flex-1">
          <TaskTable
            tasks={tasks}
            profiles={profiles}
            allTags={allTags}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>

        <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:w-72 min-[1700px]:shrink-0 min-[1700px]:grid-cols-1">
          <TaskSummary tasks={summaryTasks} label={isAdmin ? "Rezumat" : "Rezumatul meu"} />
          {/* Defalcarea o vede toată secția. Rezumatul de deasupra rămâne al
              fiecăruia; asta arată cum stau colegii. */}
          <AssigneeBreakdown tasks={tasks} profiles={profiles} />
          <TagsPanel
            allTags={allTags}
            tasks={tasks}
            filter={filter}
            onFilterChange={setFilter}
            isAdmin={isAdmin}
          />
        </aside>
      </div>
    </div>
  );
}
