"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORII,
  CATEGORII_VARSTA,
  fractiuni,
  type CategorieVarsta,
} from "@/lib/penal/categorii";
import {
  FARA_ALINEAT,
  alineatePentru,
  ceaMaiGrava,
  cheieNumar,
  gasesteInfractiune,
  numeInfractiune,
  variantePentru,
  type Infractiune,
} from "@/lib/penal/clasificare";
import { calculeazaTermen, termenText, type Termen } from "@/lib/penal/termene";
import { cn } from "@/lib/utils";

/** Culorile categoriilor, urcând cu gravitatea — ca stările din căutare. */
const TON: Record<string, string> = {
  U: "bg-green-100 text-green-700",
  MPG: "bg-blue-100 text-blue-700",
  G: "bg-amber-100 text-amber-800",
  DG: "bg-orange-100 text-orange-800",
  EG: "bg-red-100 text-red-700",
};

/**
 * Pedeapsa de sus, când e completată: din ea ies datele, nu doar fracțiile.
 */
export interface BazaTermen {
  inceput: Date;
  pedeapsa: Termen;
  zileArest: number;
}

/** O fracție, cu data ei — sau doar fracția, dacă pedeapsa nu e completată. */
function Fractie({
  fractiune,
  titlu,
  temeiLegal,
  baza,
}: {
  fractiune: string;
  titlu: string;
  temeiLegal: string;
  baza: BazaTermen | null;
}) {
  const calcul = baza
    ? calculeazaTermen(baza.inceput, baza.pedeapsa, fractiune, baza.zileArest)
    : null;

  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums">{fractiune}</p>
      {/* Două rânduri rezervate: „înlocuirea părții neexecutate" se rupe, iar
          fără înălțimea fixă datele celor două coloane ar sta la niveluri
          diferite — exact rândul pe care omul îl compară. */}
      <p className="min-h-[2rem] text-xs leading-4 text-muted-foreground">{titlu}</p>
      {calcul && (
        <p className="mt-1 text-base font-semibold">
          {format(calcul.eligibil, "d MMMM yyyy", { locale: ro })}
          <span className="block text-[11px] font-normal text-muted-foreground">
            după {termenText(calcul.deExecutat)} de executat
          </span>
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">{temeiLegal}</p>
    </div>
  );
}

/**
 * Clasificarea infracțiunii, fracțiile art. 91 / 92 și datele lor.
 *
 * Se adaugă mai multe infracțiuni fiindcă fracția se calculează pe cea mai
 * gravă dintre ele — o singură infracțiune introdusă ar da un răspuns corect
 * doar din întâmplare, când chiar aia era cea mai gravă.
 *
 * `baza` vine de la calculatorul de deasupra. Cu ea, fracția nu mai e un număr
 * pe care omul îl duce singur mai departe, ci o dată: cine socotește sfârșitul
 * termenului socotește oricum și când se poate cere liberarea. Fără ea — când
 * se caută doar categoria — se arată tot, mai puțin datele.
 */
export function ClassifyTool({ baza = null }: { baza?: BazaTermen | null }) {
  const [articol, setArticol] = useState("");
  const [alineat, setAlineat] = useState("");
  const [varsta, setVarsta] = useState<CategorieVarsta>("adult");
  const [adaugate, setAdaugate] = useState<Infractiune[]>([]);
  const [eroare, setEroare] = useState<string | null>(null);

  const alineate = useMemo(
    () => (articol.trim() ? [...new Set(alineatePentru(articol.trim()))] : []),
    [articol],
  );

  // Articolele care împart numărul scris: 217 și 217¹…217⁶. Se arată doar când
  // sunt mai multe — la un articol fără indice, un singur buton lângă câmp ar
  // fi zgomot.
  const variante = useMemo(() => {
    const gasite = variantePentru(articol.trim());
    return gasite.length > 1 ? gasite : [];
  }, [articol]);

  const alesa = cheieNumar(articol.trim());

  // Un singur alineat de ales nu e o alegere. Se completează singur — mai ales
  // la articolele fără alineate numerotate, unde lista are o intrare care spune
  // chiar că nu e nimic de ales.
  useEffect(() => {
    if (alineate.length === 1) setAlineat(alineate[0]);
  }, [alineate]);

  const adauga = () => {
    const inf = gasesteInfractiune(articol.trim(), alineat.trim());
    if (!inf) {
      setEroare(
        alineat === FARA_ALINEAT
          ? `Art. ${articol} nu e în catalog.`
          : `Art. ${articol} alin. ${alineat} nu e în catalog.`,
      );
      return;
    }
    // Aceeași infracțiune de două ori n-ar schimba cea mai gravă, dar ar face
    // lista să pară o socoteală în care nu te mai poți încrede.
    if (adaugate.some((x) => x.art === inf.art && x.alin === inf.alin)) {
      setEroare("E deja în listă.");
      return;
    }
    setAdaugate((p) => [...p, inf]);
    setArticol("");
    setAlineat("");
    setEroare(null);
  };

  const grava = ceaMaiGrava(adaugate);
  const f = grava.categorie ? fractiuni(grava.categorie, varsta) : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="grid grid-cols-[1fr,1fr,auto] items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="c-art">Articol</Label>
            <Input
              id="c-art"
              value={articol}
              onChange={(e) => {
                setArticol(e.target.value);
                setAlineat("");
                setEroare(null);
              }}
              placeholder="145 sau 217/1"
            />
          </div>
          <div className="space-y-2">
            <Label>Alineat</Label>
            <Select value={alineat} onValueChange={setAlineat} disabled={!alineate.length}>
              <SelectTrigger>
                <SelectValue placeholder={alineate.length ? "alege" : "—"} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {alineate.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a === FARA_ALINEAT ? "fără alineate" : a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={adauga} disabled={!articol.trim() || !alineat}>
            Adaugă
          </Button>
        </div>

        {variante.length > 0 && (
          /*
            Exponentul nu se poate tasta, deci articolele cu indice se aleg de
            aici. Apar de la primul număr scris, fiindcă tocmai cine nu știe că
            art. 217 mai are cinci variante are nevoie să le vadă.
          */
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Articole cu acest număr:</p>
            <div className="flex flex-wrap gap-1.5">
              {variante.map((v) => {
                const activ = cheieNumar(v) === alesa;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setArticol(v);
                      setAlineat("");
                      setEroare(null);
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors",
                      activ
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-input hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {eroare && <p className="text-xs text-destructive">{eroare}</p>}

        {adaugate.length > 0 && (
          <ul className="space-y-1">
            {adaugate.map((inf) => (
              <li
                key={`${inf.art}-${inf.alin}`}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px]"
              >
                <span className="min-w-0 flex-1">
                  {numeInfractiune(inf)}
                  <span className="ml-2 text-xs text-muted-foreground">{inf.pedeapsa_max}</span>
                </span>
                <span
                  className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TON[inf.cat])}
                >
                  {CATEGORII[inf.cat].denumire}
                </span>
                <button
                  type="button"
                  aria-label="Scoate din listă"
                  onClick={() =>
                    setAdaugate((p) =>
                      p.filter((x) => !(x.art === inf.art && x.alin === inf.alin)),
                    )
                  }
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Label>Categoria de vârstă</Label>
          <Select value={varsta} onValueChange={(v) => setVarsta(v as CategorieVarsta)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CATEGORII_VARSTA) as CategorieVarsta[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {CATEGORII_VARSTA[k].denumire}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {grava.categorie && f ? (
        <section className="space-y-3 rounded-xl border bg-muted/40 p-5">
          <div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                TON[grava.categorie],
              )}
            >
              {CATEGORII[grava.categorie].denumire}
            </span>
            <p className="mt-2 text-xs text-muted-foreground">
              hotărâtă de {grava.articolDeterminant}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <Fractie
              fractiune={f.art91.fractiune}
              titlu="Art. 91 — liberare condiționată"
              temeiLegal={f.art91.temeiLegal}
              baza={baza}
            />
            <Fractie
              fractiune={f.art92.fractiune}
              titlu="Art. 92 — înlocuirea părții neexecutate"
              temeiLegal={f.art92.temeiLegal}
              baza={baza}
            />
          </div>

          {/* Spune de unde vin datele — altfel par să iasă de nicăieri — și, când
              lipsesc, ce anume le lipsește. */}
          {baza ? (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Datele se socotesc din {format(baza.inceput, "d MMMM yyyy", { locale: ro })}, pe
              pedeapsa de {termenText(baza.pedeapsa)}
              {baza.zileArest > 0
                ? `, cu ${baza.zileArest} ${baza.zileArest === 1 ? "zi" : "zile"} de arest preventiv scăzute`
                : ""}
              .
            </p>
          ) : (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Completează sus data începerii și pedeapsa, ca fracțiile să iasă și ca date.
            </p>
          )}

          {f.art91.nota && <p className="border-t pt-3 text-xs text-amber-800">{f.art91.nota}</p>}
          <p className="text-xs text-muted-foreground">Rezultatul e orientativ.</p>
        </section>
      ) : (
        // Coloana din dreapta nu se lasă goală: altfel pagina pare stricată
        // până la prima infracțiune adăugată.
        <section className="rounded-xl border border-dashed p-5">
          <p className="text-sm text-muted-foreground">
            Adaugă articolele din sentință. Categoria se ia după cea mai gravă dintre
            ele, iar din categorie ies fracțiile pentru art. 91 și 92 — cu datele lor,
            dacă pedeapsa de sus e completată.
          </p>
        </section>
      )}
    </div>
  );
}
