"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { ClassifyTool, type BazaTermen } from "@/components/penal/classify-tool";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  scadeArest,
  scadeTermen,
  sfarsitTermen,
  termenText,
  zileIntre,
  type Termen,
} from "@/lib/penal/termene";

/**
 * Uneltele penale, pe o singură pagină.
 *
 * Sus, două socoteli de termen independente: din data începerii și reducerea
 * dispusă prin încheiere. În fereastră încăpea doar una, deci se comuta între
 * ele din pastile; alături, nu se mai alege nimic.
 *
 * Jos, clasificarea infracțiunii — nu ca a treia unealtă fără legătură, ci ca
 * urmarea firească a primei: cine socotește sfârșitul termenului socotește
 * aproape întotdeauna și categoria, și datele art. 91 și 92. Pedeapsa de sus
 * coboară acolo ca `baza`, deci fracțiile ies direct ca date. Fără ea,
 * clasificarea lucrează singură și dă doar fracțiile.
 */

/** Trei câmpuri de durată, folosite de amândouă uneltele. */
function CampuriTermen({
  valori,
  seteaza,
}: {
  valori: [string, string, string];
  seteaza: [(v: string) => void, (v: string) => void, (v: string) => void];
}) {
  const etichete = ["Ani", "Luni", "Zile"];
  return (
    <div className="grid grid-cols-3 gap-3">
      {etichete.map((eticheta, i) => (
        <div key={eticheta} className="space-y-1">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={valori[i]}
            onChange={(e) => seteaza[i](e.target.value)}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">{eticheta}</p>
        </div>
      ))}
    </div>
  );
}

function Rezultat({
  context,
  data,
  explicatie,
}: {
  context: string;
  data: Date;
  explicatie: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <p className="text-xs text-muted-foreground">{context}</p>
      <p className="mt-1 text-lg font-semibold">
        {format(data, "d MMMM yyyy", { locale: ro })}
      </p>
      <p className="text-xs text-muted-foreground">{explicatie}</p>
    </div>
  );
}

/** Cutia unei unelte: titlu, o frază despre când se folosește, și cuprinsul. */
function Unealta({
  titlu,
  cand,
  children,
}: {
  titlu: string;
  cand: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold">{titlu}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{cand}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function PenalTools() {
  // Unealta 1
  const [inceput, setInceput] = useState("");
  const [ani, setAni] = useState("");
  const [luni, setLuni] = useState("");
  const [zile, setZile] = useState("");
  const [arestActiv, setArestActiv] = useState(false);
  const [arestDeLa, setArestDeLa] = useState("");
  const [arestPanaLa, setArestPanaLa] = useState("");

  // Unealta 2
  const [sfarsitCunoscut, setSfarsitCunoscut] = useState("");
  const [redAni, setRedAni] = useState("");
  const [redLuni, setRedLuni] = useState("");
  const [redZile, setRedZile] = useState("");

  const n = (s: string) => {
    const v = Number(s);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  };
  const data = (s: string) => {
    if (!s) return null;
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const dataRo = (d: Date) => format(d, "d MMMM yyyy", { locale: ro });

  // ── Unealta 1: din data începerii ────────────────────────────────────────
  const termen: Termen = { ani: n(ani), luni: n(luni), zile: n(zile) };
  const areTermen = termen.ani + termen.luni + termen.zile > 0;

  const aDeLa = data(arestDeLa);
  const aPanaLa = data(arestPanaLa);
  const arestGresit = Boolean(arestActiv && aDeLa && aPanaLa && aPanaLa <= aDeLa);
  const zileArest =
    arestActiv && aDeLa && aPanaLa && !arestGresit ? zileIntre(aDeLa, aPanaLa) : 0;

  const start = data(inceput);
  const valid1 = start !== null && areTermen && !arestGresit;
  const sfarsit = valid1 ? sfarsitTermen(start, termen) : null;
  const cuArest = sfarsit ? scadeArest(sfarsit, zileArest) : null;

  // ── Unealta 2: din sfârșitul cunoscut ────────────────────────────────────
  const sfarsitDinDosar = data(sfarsitCunoscut);
  const reducere: Termen = { ani: n(redAni), luni: n(redLuni), zile: n(redZile) };
  const areReducere = reducere.ani + reducere.luni + reducere.zile > 0;
  const dupaReducere =
    sfarsitDinDosar && areReducere ? scadeTermen(sfarsitDinDosar, reducere) : null;

  // ── Ce coboară la clasificare ────────────────────────────────────────────
  // Doar din unealta 1, și doar când e completă: o dată de eligibilitate scoasă
  // dintr-o pedeapsă pe jumătate introdusă ar fi tot o dată plauzibilă.
  const baza: BazaTermen | null =
    valid1 && start ? { inceput: start, pedeapsa: termen, zileArest } : null;

  return (
    <div className="space-y-6">
      {/* Alături pe ecranele secției (1366 în sus), una sub alta mai jos.
          `items-start` ca a doua cutie să nu se întindă degeaba în înălțime
          după cea din stânga, care crește pe măsură ce apar rezultatele. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Unealta
          titlu="Din data începerii"
          cand="Când ai data de la care se socoate pedeapsa și durata ei."
        >
          <div className="space-y-2">
            <Label htmlFor="t-inceput">Data începerii executării</Label>
            <Input
              id="t-inceput"
              type="date"
              value={inceput}
              onChange={(e) => setInceput(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Pedeapsa</Label>
            <CampuriTermen valori={[ani, luni, zile]} seteaza={[setAni, setLuni, setZile]} />
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={arestActiv}
                onChange={(e) => setArestActiv(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="font-medium">Arest preventiv</span>
            </label>

            {arestActiv && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Input
                      type="date"
                      value={arestDeLa}
                      onChange={(e) => setArestDeLa(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">De la</p>
                  </div>
                  <div className="space-y-1">
                    <Input
                      type="date"
                      value={arestPanaLa}
                      onChange={(e) => setArestPanaLa(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Până la</p>
                  </div>
                </div>
                {arestGresit ? (
                  <p className="text-xs text-destructive">
                    Data de sfârșit trebuie să fie după cea de început.
                  </p>
                ) : (
                  zileArest > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {zileArest} {zileArest === 1 ? "zi" : "zile"} — ziua de început se
                      include, cea de sfârșit nu.
                    </p>
                  )
                )}
              </div>
            )}
          </div>

          {valid1 && start && sfarsit && cuArest && (
            <div className="space-y-3">
              <Rezultat
                context={`Pedeapsa de ${termenText(termen)}, din ${dataRo(start)}`}
                data={sfarsit}
                explicatie="sfârșitul termenului, fără arest preventiv"
              />
              {zileArest > 0 && (
                <Rezultat
                  context={`Cu ${zileArest} ${zileArest === 1 ? "zi" : "zile"} de arest preventiv scăzute`}
                  data={cuArest}
                  explicatie="sfârșitul termenului"
                />
              )}
              {/* Duce rezultatul în unealta din dreapta. Alături fiind, se vede
                  pe loc unde a ajuns — nu mai e o trecere dintr-un ecran în
                  altul, ci o completare de câmp. */}
              <button
                type="button"
                onClick={() => setSfarsitCunoscut(format(cuArest, "yyyy-MM-dd"))}
                className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Aplică o reducere pe această dată →
              </button>
            </div>
          )}
        </Unealta>

        <Unealta
          titlu="Reducere de termen"
          cand="Când sfârșitul e deja în dosar și a venit o încheiere de reducere."
        >
          <div className="space-y-2">
            <Label htmlFor="t-sfarsit">Sfârșitul termenului, cunoscut</Label>
            <Input
              id="t-sfarsit"
              type="date"
              value={sfarsitCunoscut}
              onChange={(e) => setSfarsitCunoscut(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Cel din dosar. Nu e nevoie de data începerii și de pedeapsă.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Reducerea dispusă prin încheiere</Label>
            <CampuriTermen
              valori={[redAni, redLuni, redZile]}
              seteaza={[setRedAni, setRedLuni, setRedZile]}
            />
          </div>

          {dupaReducere && sfarsitDinDosar && (
            <Rezultat
              context={`${dataRo(sfarsitDinDosar)}, redus cu ${termenText(reducere)}`}
              data={dupaReducere}
              explicatie="sfârșitul termenului după reducere"
            />
          )}
        </Unealta>
      </div>

      {/*
        Clasificarea, dedesubt. Aceeași pedeapsă merge mai departe: dacă e
        completată sus, fracțiile de la art. 91 și 92 ies ca date, nu ca numere
        pe care omul le duce singur mai departe.

        Arestul preventiv intră și el în bază, fiindcă scade la fel din data
        eligibilității ca din sfârșitul termenului.
      */}
      <section id="clasificare" className="scroll-mt-6 space-y-4 border-t pt-6">
        <div>
          <h2 className="text-lg font-semibold">Clasificarea infracțiunii</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Categoria după art. 16 CP RM și fracțiile pentru art. 91 și 92, cu datele
            lor.
          </p>
        </div>
        <ClassifyTool baza={baza} />
      </section>

      {/* Nota stă jos, sub toate: regula e aceeași oriunde se socotește. */}
      <p className="border-t pt-3 text-xs text-muted-foreground">
        Termenii exprimați numai în ani expiră în ziua precedentă zilei
        corespunzătoare; la luni și zile, chiar în ziua corespunzătoare. Rezultatul e
        orientativ.
      </p>
    </div>
  );
}
