"use client";

import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_OPTIONS } from "@/components/petitions/meta";
import type { PetitionFilter } from "@/lib/petition-filters";
import type { PetitionStatus, Profile } from "@/lib/types";

const ALL = "all";

interface PetitionFiltersBarProps {
  profiles: Profile[];
  currentUserId: string | null;
  filter: PetitionFilter;
  onFilterChange: (f: PetitionFilter) => void;
  onNewPetition?: () => void;
}

export function PetitionFiltersBar({
  profiles,
  currentUserId,
  filter,
  onFilterChange,
  onNewPetition,
}: PetitionFiltersBarProps) {
  const mineActive = !!currentUserId && filter.assigneeId === currentUserId;

  const toggleMine = () => {
    if (mineActive) {
      onFilterChange({ ...filter, assigneeId: undefined });
    } else if (currentUserId) {
      onFilterChange({ ...filter, assigneeId: currentUserId });
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter.search ?? ""}
          onChange={(e) => onFilterChange({ ...filter, search: e.target.value || undefined })}
          placeholder="Caută după număr, petiționar, obiect…"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filter.status ?? ALL}
          onValueChange={(v) =>
            onFilterChange({ ...filter, status: v === ALL ? undefined : (v as PetitionStatus) })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Stare" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toate stările</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.assigneeId ?? ALL}
          onValueChange={(v) =>
            onFilterChange({ ...filter, assigneeId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Responsabil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toți responsabilii</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name ?? "(fără nume)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={mineActive ? "default" : "outline"}
          onClick={toggleMine}
          disabled={!currentUserId}
        >
          Doar ale mele
        </Button>
      </div>

      <Button className="ml-auto" onClick={onNewPetition}>
        <Plus className="mr-1 h-4 w-4" />
        Petiție nouă
      </Button>
    </div>
  );
}
