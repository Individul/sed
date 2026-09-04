"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { restoreBackup } from "@/app/admin/actions";
import { restoreRefusal } from "@/lib/backup";

export function RestoreBackup() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const handleFile = async (file: File) => {
    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      toast.error("Fișier invalid (nu e JSON).");
      return;
    }
    // Verificarea vine **înaintea** confirmării, nu după: altfel omul ar fi
    // întrebat „restaurezi?" pentru un fișier care oricum nu se poate importa.
    const refusal = restoreRefusal(payload);
    if (refusal) {
      toast.error(refusal);
      return;
    }
    if (
      !window.confirm(
        "Restaurezi din acest backup?\nSe adaugă doar înregistrările lipsă — nu se șterge și nu se suprascrie nimic.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await restoreBackup(payload);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const i = res.inserted!;
      toast.success(
        `Restaurat: ${i.tasks} sarcini, ${i.comments} comentarii, ${i.tags} etichete, ${i.task_tags} legături.`,
      );
      router.refresh();
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" disabled={isPending} onClick={() => inputRef.current?.click()}>
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Restaurează din backup
      </Button>
    </>
  );
}
