"use client";

import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Cele două feluri de a scoate raportul din aplicație.
 *
 * Fișier separat, deși sunt doar două butoane: tipărirea cere `window.print()`,
 * deci componenta e de client, iar raportul de deasupra rămâne randat pe server
 * — altfel formatarea datelor în română ar căra locala date-fns în browser
 * pentru un singur buton.
 *
 * Descărcarea e o ancoră obișnuită, nu `next/link`: ruta întoarce un fișier, cu
 * numele lui dat de `Content-Disposition`. O navigare de client n-ar avea unde
 * să meargă.
 */
export function ExportButtons({ pdfHref }: { pdfHref: string }) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2 border-t pt-4">
      <Button asChild>
        <a href={pdfHref}>
          <Download className="mr-2 h-4 w-4" /> Descarcă PDF
        </a>
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" /> Tipărește
      </Button>
    </div>
  );
}
