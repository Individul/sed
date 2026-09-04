/**
 * Ce se vede între clic și sosirea paginii.
 *
 * Până acum nu se vedea nimic: paginile se randează pe server, iar fără fișierul
 * acesta browserul rămâne pe pagina veche, neclintit, până răspunde serverul.
 * Din afară asta nu se deosebește de o aplicație care s-a blocat — și de acolo
 * venea impresia că e mai înceată decât hub-ul vechi, care fiind o aplicație de
 * browser schimba ecranul pe loc.
 *
 * Stă lângă layout-ul rădăcină, deci înlocuiește numai ce e sub antet. Bara și
 * tab-urile rămân pe ecran, iar tab-ul apăsat se aprinde imediat: clicul are un
 * răspuns înainte ca serverul să fi apucat să răspundă.
 *
 * Un al doilea câștig, mai puțin la vedere: Next descarcă din vreme starea de
 * încărcare a rutelor din legături, deci schimbarea se desenează fără nicio
 * așteptare de rețea.
 *
 * Formele sunt anume nedeslușite — un titlu, câteva dreptunghiuri. Un schelet
 * care ar imita prea bine pagina adevărată se citește ca date care încă nu
 * există.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl p-4 xl:px-10" aria-busy="true" aria-live="polite">
      {/* Pentru cititoarele de ecran, un cuvânt; restul e doar desen. */}
      <span className="sr-only">Se încarcă…</span>
      <div aria-hidden className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded-md bg-muted" />
        <div className="h-10 w-full rounded-md bg-muted" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-40 rounded-lg bg-muted" />
          <div className="h-40 rounded-lg bg-muted" />
        </div>
        <div className="h-28 rounded-lg bg-muted" />
      </div>
    </main>
  );
}
