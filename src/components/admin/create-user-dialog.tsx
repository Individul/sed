"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
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
import { createUser } from "@/app/admin/actions";

export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFullName("");
    setUsername("");
    setPassword("");
    setError(null);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createUser({ full_name: fullName, username, password });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Utilizator creat.");
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" /> Adaugă utilizator
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adaugă utilizator</DialogTitle>
            <DialogDescription>
              Se creează un cont cu username și parolă (fără email real). Utilizatorul se
              loghează cu username-ul.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="cu-name">Nume complet</Label>
              <Input
                id="cu-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ion Popescu"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-username">Username</Label>
              <Input
                id="cu-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ipopescu"
                autoComplete="off"
                required
              />
              <p className="text-xs text-muted-foreground">
                3-30 caractere: litere, cifre, . _ -
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-password">Parolă</Label>
              <Input
                id="cu-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">Minim 8 caractere.</p>
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Anulează
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Se creează..." : "Creează"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
