"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { attachTag, detachTag } from "@/app/tasks/actions";
import type { Tag } from "@/lib/types";

interface TagPickerProps {
  taskId: string;
  taskTags: Tag[];
  allTags: Tag[];
}

export function TagPicker({ taskId, taskTags, allTags }: TagPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const attachedIds = new Set(taskTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !attachedIds.has(t.id));

  const handleAttach = (tagId: string) => {
    startTransition(async () => {
      const res = await attachTag(taskId, tagId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  };

  const handleDetach = (tagId: string) => {
    startTransition(async () => {
      const res = await detachTag(taskId, tagId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {taskTags.length === 0 && (
        <span className="text-sm text-muted-foreground">Fără etichete</span>
      )}
      {taskTags.map((tag) => (
        <Badge
          key={tag.id}
          className="gap-1 border-transparent pr-1 text-white"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
          <button
            type="button"
            aria-label={`Elimină ${tag.name}`}
            onClick={() => handleDetach(tag.id)}
            disabled={isPending}
            className="rounded-full p-0.5 transition-colors hover:bg-black/20 disabled:opacity-50"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7" disabled={isPending}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Adaugă etichetă
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {availableTags.length === 0 ? (
            <DropdownMenuItem disabled>Nicio etichetă disponibilă</DropdownMenuItem>
          ) : (
            availableTags.map((tag) => (
              <DropdownMenuItem key={tag.id} onSelect={() => handleAttach(tag.id)}>
                <span
                  className="mr-2 h-3 w-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
