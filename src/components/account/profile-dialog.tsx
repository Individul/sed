"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/app/account/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Se salvează..." : "Salvează"}
    </Button>
  );
}

interface ProfileDialogProps {
  currentFullName: string;
  currentUsername: string;
}

export function ProfileDialog({ currentFullName, currentUsername }: ProfileDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(updateProfile, null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Profil actualizat.");
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Profilul meu
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profilul meu</DialogTitle>
            <DialogDescription>
              Numele apare pe task-uri și comentarii. Username-ul îl poți folosi la login.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nume complet</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={currentFullName}
                placeholder="Nume Prenume"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                defaultValue={currentUsername}
                placeholder="ex: dprisacaru"
                autoComplete="username"
              />
              <p className="text-xs text-muted-foreground">
                Opțional. 3-30 caractere: litere, cifre, . _ - (fără spații). Folosit la login.
              </p>
            </div>
            {state?.error ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Anulează
              </Button>
              <SubmitButton />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
