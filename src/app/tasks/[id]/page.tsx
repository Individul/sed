import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getTask,
  getProfiles,
  getTags,
  getCurrentProfile,
  getTaskHistory,
  getSubtasks,
  getNotifications,
  getUnreadCount,
} from "@/lib/queries";
import { TaskDetail } from "@/components/tasks/task-detail";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const [task, profiles, allTags, currentProfile, history, subtasks, notifications, unread] =
    await Promise.all([
      getTask(params.id),
      getProfiles(),
      getTags(),
      getCurrentProfile(),
      getTaskHistory(params.id),
      getSubtasks(params.id),
      getNotifications(),
      getUnreadCount(),
    ]);
  if (!task) notFound();

  const currentUserId = currentProfile?.id ?? null;
  const isAdmin = currentProfile?.role === "admin";

  return (
    <main className="mx-auto max-w-6xl p-4 xl:px-10">
      <Link href="/sarcini">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi la sarcini
        </Button>
      </Link>
      <TaskDetail
        task={task}
        profiles={profiles}
        allTags={allTags}
        history={history}
        subtasks={subtasks}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </main>
  );
}
