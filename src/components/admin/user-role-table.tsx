"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setUserRole } from "@/app/admin/actions";
import type { Profile } from "@/lib/types";

type Role = "admin" | "member";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "member", label: "Membru" },
  { value: "admin", label: "Administrator" },
];

function initials(fullName: string | null): string {
  if (!fullName) return "—";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

interface UserRoleTableProps {
  profiles: Profile[];
  currentUserId: string;
}

export function UserRoleTable({ profiles, currentUserId }: UserRoleTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (userId: string, role: Role) => {
    startTransition(async () => {
      const res = await setUserRole(userId, role);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Utilizator</TableHead>
          <TableHead className="w-[200px]">Rol</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles.map((profile) => {
          const isSelf = profile.id === currentUserId;
          return (
            <TableRow key={profile.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {profile.avatar_url && (
                      <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />
                    )}
                    <AvatarFallback className="text-xs">
                      {initials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    {profile.full_name ?? "—"}
                    {isSelf && <span className="ml-2 text-muted-foreground">(tu)</span>}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={profile.role === "admin" ? "admin" : "member"}
                  onValueChange={(v) => handleChange(profile.id, v as Role)}
                  disabled={isSelf || isPending}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
