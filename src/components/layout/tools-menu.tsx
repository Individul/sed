"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, ChevronDown, FileStack, Scale } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Uneltele, adunate sub un singur nume în bara de sus.
 *
 * Cele două calculatoare penale stăteau pe pagina de start, lipite de „Bun
 * venit, …", și de acolo veneau două neajunsuri. Unul de rang: arătau ca
 * acțiunile acelui titlu, când sunt de fapt o destinație a aplicației. Altul,
 * mai greu: la ele se ajungea doar de acasă, deși tocmai în mijlocul unei
 * petiții sau al unei sarcini îți trebuie un termen — și atunci omul își pierde
 * locul ca să se întoarcă după el.
 *
 * Nu sunt tab-uri lângă module fiindcă nu sunt registre: nu se completează, nu
 * păstrează nimic, nu au rânduri. Se intră când ai ceva de făcut cu ele și se
 * iese. De aici meniul — un singur cuvânt în bară, deschis de oriunde.
 *
 * Uneltele PDF au venit mai târziu, de pe serverul Hetzner care se închide.
 * Erau singurul lucru de acolo fără înlocuitor aici, iar meniul avea deja
 * numele potrivit pentru ele.
 */
const UNELTE = [
  {
    href: "/termen",
    icon: CalendarClock,
    nume: "Calculator termen și clasificare",
    descriere: "Sfârșitul pedepsei, art. 91 și 92",
  },
  {
    href: "/cumul",
    icon: Scale,
    nume: "Concurs sau cumul de sentințe",
    descriere: "Art. 84 alin. (4) sau art. 85 CP RM",
    // Aceeași vorbă ca filigranul de pe pagină: cine o vede aici n-are cum s-o
    // ia drept unealtă așezată doar fiindcă a intrat prin meniu.
    inTestare: true,
  },
  {
    href: "/pdf",
    icon: FileStack,
    nume: "Unelte PDF",
    descriere: "Unește, șterge sau extrage pagini",
  },
] as const;

export function ToolsMenu() {
  const pathname = usePathname();
  const activ = UNELTE.some((u) => pathname === u.href || pathname.startsWith(`${u.href}/`));

  return (
    <DropdownMenu>
      {/* Aceleași forme ca tab-urile modulelor: e tot o intrare în bară, iar un
          buton conturat ar fi strigat mai tare decât registrele. */}
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring",
          activ
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        Unelte
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </DropdownMenuTrigger>
      {/* Lat de 80, nu de 72: acolo numele celei de-a doua unelte împingea
          eticheta „în testare" pe rândul următor, iar explicația primei se
          rupea în două. Așa fiecare ține două rânduri curate — numele cu
          eticheta lui, explicația sub el. */}
      <DropdownMenuContent align="start" className="w-80">
        {UNELTE.map((u) => {
          const Icon = u.icon;
          return (
            <DropdownMenuItem key={u.href} asChild className="cursor-pointer">
              <Link href={u.href} className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium leading-snug">
                    {u.nume}
                    {"inTestare" in u && u.inTestare && (
                      <span className="ml-1.5 whitespace-nowrap rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800">
                        în testare
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">{u.descriere}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
