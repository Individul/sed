import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AppHeaderSchelet, AppHeaderSlot } from "@/components/layout/app-header-slot";
import { ANTET_SESIUNE } from "@/lib/session-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sarcini · Secția evidența deținuți",
  description: "Gestionarea sarcinilor — Secția evidența deținuți",
};

/**
 * Antetul stă aici, nu în fiecare pagină.
 *
 * Îl desenau singure șaisprezece pagini, și de acolo venea o bună parte din
 * impresia că aplicația e mai înceată decât hub-ul vechi. Ce stă într-un layout
 * rămâne montat între pagini; ce stă în pagină se aruncă și se face din nou.
 * Așa că fiecare clic ștergea bara, tab-urile și clopoțelul, le lăsa lipsă cât
 * ținea randarea pe server, apoi le punea înapoi — adică semăna leit cu o
 * reîncărcare de pagină, chiar dacă nu era.
 *
 * Layout-ul nu așteaptă nimic el însuși. Prima oară l-am scris cu `await` pe
 * datele antetului, și asta ținea pe loc tot ce venea după: nu pleca niciun
 * octet până nu se întorcea autentificarea, deci nici scheletul paginii nu
 * apărea mai devreme — adică tocmai ce voiam să reparăm rămânea în urma unui
 * drum prin rețea. Acum antetul curge sub `Suspense`, iar `loading.tsx` de
 * alături desenează conținutul pe loc.
 *
 * Layout-ul rădăcină nu se re-randează la navigare, deci datele antetului sunt
 * cele de la deschiderea aplicației. Nu e o scăpare: clopoțelul e abonat la
 * schimbări în timp real și se ține singur la zi, iar numele din profil se
 * împrospătează prin `router.refresh()` după salvare.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Doar ca să știm dacă rezervăm locul barei. Fără indiciul ăsta, pagina de
  // autentificare ar arăta o clipă un schelet de bară, care apoi dispare.
  const areSesiune = headers().get(ANTET_SESIUNE) === "1";

  return (
    <html lang="ro">
      <body>
        {areSesiune && (
          <Suspense fallback={<AppHeaderSchelet />}>
            <AppHeaderSlot />
          </Suspense>
        )}
        {children}
        <Toaster richColors position="top-right" />
        <SpeedInsights />
      </body>
    </html>
  );
}
