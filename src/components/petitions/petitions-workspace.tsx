"use client";

import { useState } from "react";

import { PetitionAssigneeBreakdown } from "@/components/petitions/petition-assignee-breakdown";
import { PetitionQuickViews } from "@/components/petitions/petition-quick-views";
import { PetitionSummary } from "@/components/petitions/petition-summary";
import { PetitionsList } from "@/components/petitions/petitions-list";
import type { PetitionFilter } from "@/lib/petition-filters";
import type { Petition, Profile } from "@/lib/types";

interface PetitionsWorkspaceProps {
  petitions: Petition[];
  profiles: Profile[];
  currentUserId: string | null;
  isAdmin: boolean;
  /** Petiția de deschis la sosire, din adresă — vine dintr-o notificare. */
  openPetitionId?: string;
}

export function PetitionsWorkspace({
  petitions,
  profiles,
  currentUserId,
  isAdmin,
  openPetitionId,
}: PetitionsWorkspaceProps) {
  /*
   * Registrul se deschide pe petițiile în examinare.
   *
   * Măsurat pe datele din producție: din 348 de petiții, 335 sunt soluționate
   * și 13 în examinare. Deschis pe „Toate", browserul desena 8 648 de elemente
   * ca să arate 13 rânduri de lucru sub un teanc de arhivă. Randarea listei, pe
   * un calculator rapid: 145 ms înainte, 38 după; elementele din pagină, de la
   * 8 648 la 369. Pe un calculator de birou, diferența e mai mare, nu mai mică.
   *
   * Nu e o strâmtorare de dragul vitezei: soluționatele sunt arhivă, iar ce se
   * lucrează dimineața sunt cele deschise. Registrul întreg e la un clic, pe
   * „Toate"; nimic nu s-a ascuns, doar s-a schimbat ce se vede întâi.
   *
   * Membrul păstrează și îngustarea la petițiile lui, ca înainte.
   */
  const [filter, setFilter] = useState<PetitionFilter>(
    isAdmin || !currentUserId
      ? { status: "in_examinare" }
      : { assigneeId: currentUserId, status: "in_examinare" },
  );
  // Membrii văd rezumatul propriilor petiții; adminul vede totalul + per utilizator.
  const summaryPetitions = isAdmin
    ? petitions
    : petitions.filter((p) => p.assignee_id === currentUserId);

  /*
   * Fiecare bară laterală se așază lângă tabel abia de la lățimea la care chiar
   * încape, nu de la 1024px ca înainte.
   *
   * Socoteala care a impus asta, pe un ecran de 1366: cele două bare plus
   * golurile dintre ele luau 608px, iar tabelului îi rămâneau 726 — cu peste 100
   * mai puțin decât suma coloanelor lui. „Obiect” e singura coloană elastică,
   * deci se strângea la zero și apoi conținutul dădea peste vecini: antetele se
   * suprapuneau, iar „Stare” ieșea din ecran.
   *
   * Vederile (224px) rămân lângă tabel de la 1280. Rezumatul (288px) cere 1700,
   * altfel coboară sub tabel pe două coloane — acolo se citește la fel de bine,
   * fiindcă e informație de referință, nu navigare.
   */
  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
      <aside className="xl:w-56 xl:shrink-0">
        <PetitionQuickViews
          petitions={petitions}
          currentUserId={currentUserId}
          filter={filter}
          onFilterChange={setFilter}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6 min-[1700px]:flex-row min-[1700px]:items-start min-[1700px]:gap-8">
        <div className="min-w-0 flex-1">
          <PetitionsList
            petitions={petitions}
            profiles={profiles}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            filter={filter}
            onFilterChange={setFilter}
            openPetitionId={openPetitionId}
          />
        </div>

        <aside className="grid gap-4 sm:grid-cols-2 min-[1700px]:w-72 min-[1700px]:shrink-0 min-[1700px]:grid-cols-1">
          <PetitionSummary
            petitions={summaryPetitions}
            label={isAdmin ? "Rezumat" : "Rezumatul meu"}
          />
          {/* Ca la sarcini: rezumatul e al fiecăruia, defalcarea e a secției. */}
          <PetitionAssigneeBreakdown petitions={petitions} profiles={profiles} />
        </aside>
      </div>
    </div>
  );
}
