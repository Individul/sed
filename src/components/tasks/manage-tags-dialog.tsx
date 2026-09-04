"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateTag, deleteTag } from "@/app/tasks/actions";
import type { Tag } from "@/lib/types";

function TagRow({ tag, onChanged }: { tag: Tag; onChanged: () => void }) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [isPending, startTransition] = useTransition();
  const dirty = name.trim() !== tag.name || color !== tag.color;

  const save = () => {
    startTransition(async () => {
      const res = await updateTag(tag.id, name, color);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Etichetă actualizată");
      onChanged();
    });
  };

  const remove = () => {
    if (!window.confirm(`Ștergi eticheta „${tag.name}”? Se va elimina de pe toate sarcinile.`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteTag(tag.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Etichetă ștearsă");
      onChanged();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        aria-label="Culoare etichetă"
        className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
      />
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" />
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        onClick={save}
        disabled={isPending || !dirty || !name.trim()}
      >
        Salvează
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={remove}
        disabled={isPending}
        aria-label={`Șterge ${tag.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ManageTagsDialog({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        <Pencil className="mr-1 h-3.5 w-3.5" /> Gestionează
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionează etichetele</DialogTitle>
            <DialogDescription>
              Redenumește, schimbă culoarea sau șterge. Ștergerea elimină eticheta de pe toate
              sarcinile.
            </DialogDescription>
          </DialogHeader>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nicio etichetă.</p>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {tags.map((t) => (
                <TagRow key={t.id} tag={t} onChanged={() => router.refresh()} />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
