import Link from "next/link";

import { PdfTool } from "@/components/pdf/pdf-tool";

export const dynamic = "force-dynamic";

/**
 * Unelte pe fișiere PDF: unire, ștergere de pagini, extragere de pagini.
 *
 * Adusă din PDF Toolbox, aplicația care rula pe serverul Hetzner. Acolo
 * fișierul se încărca pe server, îl prelucra qpdf și se întorcea înapoi; aici
 * nu pleacă nicăieri — se lucrează în browser, cu `pdf-lib`, care era deja în
 * proiect pentru raportul de marți.
 *
 * Nu e o mutare de dragul curățeniei. Serverul acela nu mai are ce livra, dar
 * uneltele astea erau singurul lucru de pe el fără înlocuitor aici. Iar forma
 * veche oricum nu s-ar fi putut muta ca atare: funcțiile Vercel primesc cel
 * mult 4,5 MB în corpul cererii, adică mai puțin decât un dosar scanat.
 */
export default async function PdfPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 xl:px-10">
      <div className="mb-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Unelte PDF</h1>
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Acasă
        </Link>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Unește mai multe PDF-uri într-unul singur, scoate paginile care nu trebuie sau
        ia numai paginile care trebuie. Fișierele rămân pe calculatorul tău — nu se
        încarcă nicăieri.
      </p>
      <PdfTool />
    </main>
  );
}
