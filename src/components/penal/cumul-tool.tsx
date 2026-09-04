"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lantulTemeiurilor, type PasLant, type Temei } from "@/lib/penal/cumul";
import { cn } from "@/lib/utils";

/**
 * Care articol se aplică la fiecare sentință care se adaugă celor dinainte.
 *
 * Unealta răspunde la o singură întrebare și se oprește acolo: pedeapsa
 * definitivă o stabilește instanța, prin cumul total sau parțial, iar un
 * calculator care ar da o cifră ar da-o cu aerul că e singura posibilă. Ce se
 * poate spune fără urmă de îndoială e temeiul — și tocmai el se încurcă, fiindcă
 * amândouă articolele vorbesc despre un om cu mai multe sentințe.
 *
 * Sentințele sunt o listă, nu două câmpuri: în dosar sunt des trei sau patru, iar
 * temeiul se poate schimba de la o treaptă la alta. O unealtă care ar ști doar
 * două ar fi lăsat restul de socotit pe hârtie, adică exact partea grea.
 */

interface Descriere {
  titlu: string;
  temeiLegal: string;
  ton: string;
  urmarea: string;
  plafon?: string;
}

const DESCRIERI: Record<Temei, Descriere> = {
  art84: {
    titlu: "Concurs de infracțiuni",
    temeiLegal: "art. 84 alin. (4) CP RM",
    ton: "bg-blue-100 text-blue-700",
    urmarea:
      "Pedeapsa definitivă se stabilește prin cumul, total sau parțial, al pedepselor aplicate. Durata deja executată în baza sentinței anterioare INTRĂ în termen. Dacă toate faptele sunt ușoare și/sau mai puțin grave, pedeapsa mai ușoară poate fi absorbită de cea mai aspră.",
    plafon: "25 de ani — 20 pentru cei între 18 și 21 de ani, 12 ani și 6 luni pentru minori",
  },
  art85: {
    titlu: "Cumul de sentințe",
    temeiLegal: "art. 85 CP RM",
    ton: "bg-amber-100 text-amber-800",
    urmarea:
      "La pedeapsa aplicată prin noua sentință SE ADAUGĂ, în întregime sau parțial, partea neexecutată din pedeapsa anterioară. Definitiva trebuie să fie mai mare și decât pedeapsa nouă, și decât partea neexecutată. Dacă una dintre sentințe e detențiune pe viață, definitiva e detențiune pe viață.",
    plafon: "30 de ani — 20 pentru cei între 18 și 21 de ani, 15 pentru minori",
  },
  niciunul: {
    titlu: "Nici concurs, nici cumul",
    temeiLegal: "cauză de sine stătătoare",
    ton: "bg-muted text-foreground",
    urmarea:
      "Fapta a fost săvârșită după executarea completă a pedepsei anterioare, deci art. 85 nu se aplică — el cere ca fapta să fie săvârșită înainte de executarea completă. Pedeapsa se stabilește numai pentru noua infracțiune.",
  },
};

interface Rand {
  id: number;
  pronuntare: string;
  savarsire: string;
  sfarsit: string;
}

const randGol = (id: number): Rand => ({ id, pronuntare: "", savarsire: "", sfarsit: "" });

export function CumulTool() {
  const [randuri, setRanduri] = useState<Rand[]>([randGol(1), randGol(2)]);
  const [urmatorulId, setUrmatorulId] = useState(3);

  const data = (s: string) => {
    if (!s) return null;
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const dataRo = (d: Date) => format(d, "d MMMM yyyy", { locale: ro });

  const schimba = (id: number, camp: keyof Omit<Rand, "id">, valoare: string) =>
    setRanduri((p) => p.map((r) => (r.id === id ? { ...r, [camp]: valoare } : r)));

  const adauga = () => {
    setRanduri((p) => [...p, randGol(urmatorulId)]);
    setUrmatorulId((n) => n + 1);
  };

  // Sub două sentințe n-ar mai fi nimic de cumulat, deci ultimele două rânduri
  // nu se pot scoate.
  const scoate = (id: number) =>
    setRanduri((p) => (p.length > 2 ? p.filter((r) => r.id !== id) : p));

  // Rândurile pe jumătate completate nu intră în socoteală, dar nici nu opresc
  // restul: se scrie de sus în jos, iar răspunsul trebuie să apară pe măsură.
  const complete = randuri
    .map((r) => ({
      pronuntare: data(r.pronuntare),
      savarsire: data(r.savarsire),
      sfarsit: data(r.sfarsit),
    }))
    .filter((r) => r.pronuntare && r.savarsire)
    .map((r) => ({
      pronuntare: r.pronuntare as Date,
      savarsire: r.savarsire as Date,
      sfarsit: r.sfarsit,
    }));

  const pasi = complete.length >= 2 ? lantulTemeiurilor(complete) : [];
  const temeiuriFolosite = [...new Set(pasi.map((p) => p.temei))];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        {randuri.map((r, i) => (
          <div key={r.id} className="space-y-3 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Sentința {i + 1}</h2>
              {randuri.length > 2 && (
                <button
                  type="button"
                  aria-label={`Scoate sentința ${i + 1}`}
                  onClick={() => scoate(r.id)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`p-${r.id}`} className="text-xs">
                  Data pronunțării
                </Label>
                <Input
                  id={`p-${r.id}`}
                  type="date"
                  value={r.pronuntare}
                  onChange={(e) => schimba(r.id, "pronuntare", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`s-${r.id}`} className="text-xs">
                  Data săvârșirii faptei
                </Label>
                <Input
                  id={`s-${r.id}`}
                  type="date"
                  value={r.savarsire}
                  onChange={(e) => schimba(r.id, "savarsire", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`f-${r.id}`} className="text-xs font-normal text-muted-foreground">
                Sfârșitul pedepsei stabilite prin ea (dacă e cunoscut)
              </Label>
              <Input
                id={`f-${r.id}`}
                type="date"
                value={r.sfarsit}
                onChange={(e) => schimba(r.id, "sfarsit", e.target.value)}
              />
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={adauga}>
          <Plus className="mr-2 h-4 w-4" />
          Adaugă o sentință
        </Button>

        {/* Ordinea din formular nu contează, dar cine scrie într-o listă crede
            de obicei că da. */}
        <p className="text-xs text-muted-foreground">
          Ordinea în care le scrii nu contează: se așază singure după data pronunțării.
          Ziua pronunțării, nu cea a rămânerii definitive — așa scriu amândouă articolele.
          Temeiul fiecărei sentințe se hotărăște față de prima: art. 84 alin. (4) o numește
          „sentinţa în prima cauză”.
        </p>
      </section>

      {pasi.length > 0 ? (
        <section className="space-y-4">
          {pasi.map((pas) => (
            <Treapta key={pas.numar} pas={pas} dataRo={dataRo} />
          ))}

          {/* Urmările se scriu o dată pentru fiecare temei apărut în lanț, nu la
              fiecare treaptă: la patru sentințe, același paragraf repetat de
              trei ori ar îneca chiar răspunsul. */}
          <div className="space-y-3 rounded-xl border p-5">
            {temeiuriFolosite.map((t) => (
              <div key={t} className="space-y-1">
                <p className="text-xs font-medium">{DESCRIERI[t].temeiLegal}</p>
                <p className="text-xs text-muted-foreground">{DESCRIERI[t].urmarea}</p>
                {DESCRIERI[t].plafon && (
                  <p className="text-xs text-muted-foreground">
                    Pedeapsa definitivă nu poate depăși {DESCRIERI[t].plafon}.
                  </p>
                )}
              </div>
            ))}
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Pedeapsa definitivă o stabilește instanța. Aici se arată doar temeiul.
            </p>
            {/* Scris și aici, nu doar în filigran: acesta e locul din care omul
                pleacă mai departe cu un răspuns. */}
            <p className="text-xs font-medium text-amber-800">
              Unealta e încă în testare — verifică temeiul înainte de a-l folosi.
            </p>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed p-5">
          <p className="text-sm text-muted-foreground">
            Întrebarea de fond e dacă omul era deja condamnat când a săvârșit fapta.
            Fapta dinaintea primei sentințe e concurs de infracțiuni; cea de după, cumul de
            sentințe. Nu contează gravitatea, ordinea în care au venit sentințele și nici
            când s-a descoperit fapta.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Oricâte ar fi, toate se cântăresc față de prima — ea e „prima cauză” din art.
            84 alin. (4).
          </p>
        </section>
      )}
    </div>
  );
}

function Treapta({ pas, dataRo }: { pas: PasLant; dataRo: (d: Date) => string }) {
  const d = DESCRIERI[pas.temei];
  return (
    <div className="space-y-3 rounded-xl border bg-muted/40 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-background px-2 py-0.5 text-xs font-medium tabular-nums">
          Sentința {pas.numar}
        </span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", d.ton)}>
          {d.titlu}
        </span>
      </div>
      <p className="text-lg font-semibold">{d.temeiLegal}</p>

      {/* Motivul, scris în datele introduse: un temei fără el nu se poate
          verifica, iar aici verificarea o face un om. */}
      <p className="border-t pt-3 text-sm">
        {pas.temei === "art84"
          ? `Fapta a fost săvârșită la ${dataRo(pas.sentinta.savarsire)}, înainte de pronunțarea sentinței 1 (${dataRo(pas.prima.pronuntare)}), deci pe atunci omul nu era condamnat.`
          : pas.temei === "art85"
            ? `Fapta a fost săvârșită la ${dataRo(pas.sentinta.savarsire)}, după pronunțarea sentinței 1 (${dataRo(pas.prima.pronuntare)}), deci omul era deja condamnat${
                pas.inExecutare?.sfarsit
                  ? ` și executa pedeapsa din sentința ${pas.numarInExecutare}, până la ${dataRo(pas.inExecutare.sfarsit)}`
                  : ""
              }.`
            : `Fapta a fost săvârșită la ${dataRo(pas.sentinta.savarsire)}, după executarea completă a pedepsei din sentința ${pas.numarInExecutare}${
                pas.inExecutare?.sfarsit ? ` (${dataRo(pas.inExecutare.sfarsit)})` : ""
              }.`}
      </p>

      {pas.aceeasiZi && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Fapta e săvârșită chiar în ziua pronunțării sentinței 1. „Înainte” și
          „după” se despart la ora citirii sentinței, iar data singură nu o cuprinde: dacă
          fapta a fost săvârșită mai devreme în acea zi, temeiul e art. 84 alin. (4).
        </p>
      )}

      {pas.dataImposibila && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          Fapta e datată după propria sentință. Una dintre cele două date e greșită.
        </p>
      )}

      {pas.temei === "art85" && !pas.inExecutare?.sfarsit && (
        <p className="text-xs text-muted-foreground">
          Sub condiția că pedeapsa nu era executată integral la data faptei — completează
          sfârșitul pedepsei din sentința {pas.numarInExecutare ?? 1} ca să se verifice și
          asta.
        </p>
      )}
    </div>
  );
}
