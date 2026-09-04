"use client";

import { useRef, useState } from "react";
import { Download, FilePlus2, GripVertical, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EroarePagini, paginiDePastrat } from "@/lib/pdf/pagini";
import {
  EroarePdf,
  numaraPagini,
  numeRezultat,
  pastreazaPagini,
  uneste,
  type FisierPdf,
} from "@/lib/pdf/operatii";
import { reordoneaza } from "@/lib/reordoneaza";
import { cn } from "@/lib/utils";

/**
 * Unelte pe fișiere PDF: unire, ștergere de pagini, extragere de pagini.
 *
 * Totul se petrece în browser — fișierul nu se încarcă nicăieri. Prin unealta
 * asta trec dosare cu date personale, iar cea de dinainte, de pe serverul
 * Hetzner, le urca pe server ca să le prelucreze acolo. Aici nu pleacă nimic de
 * pe calculator, nici măcar pentru o clipă.
 *
 * Cele trei operații stau sub aceeași pagină, cu un comutator: sunt trei feluri
 * de a spune ce pagini rămân, nu trei unelte. Iar cine intră să șteargă pagini
 * își dă des seama pe loc că voia, de fapt, să le extragă.
 */

type Mod = "uneste" | "sterge" | "extrage";

interface DescriereMod {
  eticheta: string;
  titlu: string;
  explicatie: string;
  adaos: string;
}

const MODURI: Record<Mod, DescriereMod> = {
  uneste: {
    eticheta: "Unește",
    titlu: "Unește mai multe PDF-uri",
    explicatie:
      "Fișierele se leagă cap la cap, în ordinea din listă. Ordinea o schimbi trăgând fișierul de mânerul din stânga.",
    adaos: "unit",
  },
  sterge: {
    eticheta: "Șterge pagini",
    titlu: "Șterge pagini dintr-un PDF",
    explicatie: "Paginile scrise se scot; restul rămâne, în aceeași ordine.",
    adaos: "fara-pagini",
  },
  extrage: {
    eticheta: "Extrage pagini",
    titlu: "Extrage pagini dintr-un PDF",
    explicatie: "Rămân numai paginile scrise, în ordinea în care le scrii.",
    adaos: "extras",
  },
};

/** Un fișier ales, cu numărul lui de pagini deja aflat. */
interface FisierAles extends FisierPdf {
  pagini: number;
}

const MAXIM_FISIERE = 20;

export function PdfTool() {
  const [mod, setMod] = useState<Mod>("uneste");
  const [fisiere, setFisiere] = useState<FisierAles[]>([]);
  const [spec, setSpec] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [lucreaza, setLucreaza] = useState(false);
  // Rândul luat cu mâna și rândul deasupra căruia stă acum. Al doilea e numai
  // pentru desen: fără el n-ai vedea unde se va așeza înainte să dai drumul.
  const [tras, setTras] = useState<number | null>(null);
  const [deasupra, setDeasupra] = useState<number | null>(null);
  const camp = useRef<HTMLInputElement>(null);

  const unSingurFisier = mod !== "uneste";
  const descriere = MODURI[mod];

  function schimbaModul(nou: Mod) {
    setMod(nou);
    setEroare(null);
    // Fișierele rămân la trecerea între ștergere și extragere — e același
    // document, doar întrebarea e alta. Spre unire și dinspre ea se golește:
    // acolo lista are alt înțeles.
    if ((nou === "uneste") !== (mod === "uneste")) {
      setFisiere([]);
      setSpec("");
    }
  }

  async function alegeFisiere(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setEroare(null);
    setLucreaza(true);
    try {
      const noi: FisierAles[] = [];
      for (const f of Array.from(lista)) {
        const octeti = new Uint8Array(await f.arrayBuffer());
        // Numărul de pagini se află acum, nu la apăsarea butonului: fără el
        // n-ai ști ce să scrii în câmpul de pagini, iar un fișier care nu se
        // poate citi trebuie spus imediat, nu după ce ai scris specificația.
        const pagini = await numaraPagini(octeti, f.name);
        noi.push({ nume: f.name, octeti, pagini });
      }

      setFisiere((vechi) => {
        const toate = unSingurFisier ? noi.slice(0, 1) : [...vechi, ...noi];
        if (toate.length > MAXIM_FISIERE) {
          setEroare(`Cel mult ${MAXIM_FISIERE} fișiere deodată.`);
          return toate.slice(0, MAXIM_FISIERE);
        }
        return toate;
      });
      if (unSingurFisier) setSpec("");
    } catch (e) {
      setEroare(mesaj(e));
    } finally {
      setLucreaza(false);
      // Fără asta, același fișier ales a doua oară n-ar declanșa nimic:
      // câmpul are aceeași valoare, deci nu se schimbă.
      if (camp.current) camp.current.value = "";
    }
  }

  /**
   * Scoate fișierul de pe locul lui și îl pune pe altul.
   *
   * Nu e o schimbare între vecini, ci o mutare: la tragere fișierul poate sări
   * peste mai multe rânduri deodată, iar cine trage al cincilea peste primul se
   * așteaptă să-l vadă primul — nu pe primul ajuns al cincilea.
   */
  function muta(de: number, la: number) {
    setFisiere((f) => reordoneaza(f, de, la));
  }

  function scoate(index: number) {
    setFisiere((f) => f.filter((_, i) => i !== index));
    setEroare(null);
  }

  /**
   * Ce pagini rămân, socotite din ce s-a scris până acum.
   *
   * Se recalculează la fiecare tastă ca să se poată arăta sub câmp — deci o
   * specificație pe jumătate scrisă ajunge des aici, iar greșeala ei nu e încă
   * o greșeală. De aceea se înghite: se arată abia la apăsarea butonului.
   */
  const previzualizare = (() => {
    if (unSingurFisier && fisiere.length === 1 && spec.trim()) {
      try {
        return paginiDePastrat(spec, fisiere[0].pagini, mod === "sterge" ? "sterge" : "extrage");
      } catch {
        return null;
      }
    }
    return null;
  })();

  async function executa() {
    setEroare(null);
    setLucreaza(true);
    try {
      let rezultat: Uint8Array;
      let numeSursa: string;

      if (mod === "uneste") {
        rezultat = await uneste(fisiere);
        numeSursa = fisiere[0].nume;
      } else {
        const f = fisiere[0];
        const pagini = paginiDePastrat(spec, f.pagini, mod === "sterge" ? "sterge" : "extrage");
        rezultat = await pastreazaPagini(f, pagini);
        numeSursa = f.nume;
      }

      descarca(rezultat, numeRezultat(numeSursa, descriere.adaos));
    } catch (e) {
      setEroare(mesaj(e));
    } finally {
      setLucreaza(false);
    }
  }

  const gata =
    !lucreaza &&
    (mod === "uneste" ? fisiere.length >= 2 : fisiere.length === 1 && spec.trim().length > 0);

  return (
    <div className="space-y-6">
      {/* Comutatorul de mod. Butoane, nu file: pe o pagină fără alt conținut,
          filele ar promite că sub ele se schimbă mai mult decât o întrebare. */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MODURI) as Mod[]).map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant={m === mod ? "default" : "outline"}
            onClick={() => schimbaModul(m)}
          >
            {MODURI[m].eticheta}
          </Button>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold">{descriere.titlu}</h2>
        <p className="text-sm text-muted-foreground">{descriere.explicatie}</p>
      </div>

      {/* Câmpul de fișier e ascuns, iar deschiderea o face un buton al nostru.
          Butonul nativ își scrie singur textul, în limba browserului — „Выбрать
          файлы" sau „Choose files" în mijlocul unei pagini românești, după cum
          e așezat calculatorul. Aici scrie ce trebuie, în orice browser. */}
      <div className="space-y-2">
        <span className="block text-sm font-medium">
          {unSingurFisier ? "Fișierul PDF" : "Fișierele PDF (cel puțin două)"}
        </span>
        <input
          ref={camp}
          type="file"
          accept="application/pdf,.pdf"
          multiple={!unSingurFisier}
          className="sr-only"
          onChange={(e) => alegeFisiere(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={lucreaza}
          onClick={() => camp.current?.click()}
        >
          <FilePlus2 className="mr-2 h-4 w-4" />
          {unSingurFisier
            ? fisiere.length === 1
              ? "Alege alt fișier"
              : "Alege fișierul"
            : "Adaugă fișiere"}
        </Button>
      </div>

      {fisiere.length > 0 && (
        <ul className="space-y-1">
          {fisiere.map((f, i) => (
            <li
              key={`${f.nume}-${i}`}
              draggable={!unSingurFisier && !lucreaza}
              onDragStart={(e) => {
                setTras(i);
                // Fără date, Firefox nu pornește tragerea deloc.
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                if (tras === null) return;
                // Implicit, browserul refuză să lase ceva să cadă aici.
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDeasupra(i);
              }}
              onDragLeave={() => setDeasupra((d) => (d === i ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                if (tras !== null) muta(tras, i);
                setTras(null);
                setDeasupra(null);
              }}
              // Și când tragerea se termină în gol: altfel rândul ar rămâne
              // pe jumătate șters până la următoarea atingere.
              onDragEnd={() => {
                setTras(null);
                setDeasupra(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors",
                // Mâna pe tot rândul, nu doar pe mâner: rândul întreg e cel
                // care se trage, iar mânerul doar arată de unde se apucă. Dacă
                // mâna s-ar vedea numai deasupra lui, restul rândului ar părea
                // că nu se mișcă — și tocmai peste nume trece mausul întâi.
                !unSingurFisier && !lucreaza && "cursor-grab active:cursor-grabbing",
                tras === i && "opacity-40",
                deasupra === i && tras !== i && "border-primary bg-muted",
              )}
            >
              {!unSingurFisier && (
                <>
                  {/* Mânerul. Nu mută el nimic la clic — tragerea o duce rândul
                      întreg — dar arată unde se pune degetul, iar de la
                      tastatură săgețile lui fac aceeași mutare. Cine nu poate
                      trage cu mausul rămâne astfel cu o cale. */}
                  <button
                    type="button"
                    className="shrink-0 cursor-grab text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                    aria-label={`Mută „${f.nume}” — trage cu mausul sau folosește săgețile sus și jos`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp" && i > 0) {
                        e.preventDefault();
                        muta(i, i - 1);
                      } else if (e.key === "ArrowDown" && i < fisiere.length - 1) {
                        e.preventDefault();
                        muta(i, i + 1);
                      }
                    }}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{i + 1}.</span>
                </>
              )}
              <span className="min-w-0 flex-1 truncate" title={f.nume}>
                {f.nume}
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                {f.pagini} {f.pagini === 1 ? "pagină" : "pagini"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer"
                onClick={() => scoate(i)}
                aria-label={`Scoate „${f.nume}”`}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {unSingurFisier && fisiere.length === 1 && (
        <div className="space-y-2">
          <label htmlFor="pagini" className="block text-sm font-medium">
            {mod === "sterge" ? "Paginile de șters" : "Paginile de păstrat"}
          </label>
          <Input
            id="pagini"
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="1,3,5-7"
            // Fără `inputMode="numeric"`: tastatura de cifre a telefonului n-are
            // nici virgulă, nici linie, adică tocmai ce trebuie scris aici.
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Pagini răzlețe cu virgulă, intervale cu linie: <code>1,3,5-7</code>. Documentul are{" "}
            {fisiere[0].pagini} {fisiere[0].pagini === 1 ? "pagină" : "pagini"}.
          </p>
          {previzualizare && (
            <p className="text-xs font-medium">
              Rămân {previzualizare.length}{" "}
              {previzualizare.length === 1 ? "pagină" : "pagini"}:{" "}
              <span className="tabular-nums text-muted-foreground">
                {listaScurta(previzualizare)}
              </span>
            </p>
          )}
        </div>
      )}

      {eroare && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {eroare}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={executa} disabled={!gata}>
          {lucreaza ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {mod === "uneste" ? "Unește și descarcă" : "Salvează și descarcă"}
        </Button>
        {fisiere.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={lucreaza}
            onClick={() => {
              setFisiere([]);
              setSpec("");
              setEroare(null);
            }}
          >
            Golește
          </Button>
        )}
      </div>

      <p className={cn("text-xs text-muted-foreground")}>
        Fișierele nu pleacă de pe calculatorul tău: prelucrarea se face în browser, iar
        rezultatul se salvează direct în Descărcări.
      </p>
    </div>
  );
}

/** „1, 3, 5-7" — un rezumat citibil chiar și pentru trei sute de pagini. */
function listaScurta(pagini: number[]): string {
  const bucati: string[] = [];
  let i = 0;
  while (i < pagini.length) {
    let j = i;
    while (j + 1 < pagini.length && pagini[j + 1] === pagini[j] + 1) j++;
    bucati.push(i === j ? `${pagini[i]}` : `${pagini[i]}-${pagini[j]}`);
    i = j + 1;
  }
  return bucati.join(", ");
}

/**
 * Mesajul arătat omului.
 *
 * Greșelile noastre — de pagini sau de PDF — sunt scrise ca să fie citite, deci
 * trec așa cum sunt. Orice altceva e o defecțiune, nu o greșeală a lui, iar
 * textul ei tehnic n-ar spune nimic; mai bine o frază care spune ce să facă.
 */
function mesaj(e: unknown): string {
  if (e instanceof EroarePagini || e instanceof EroarePdf) return e.message;
  return "Fișierul nu a putut fi prelucrat. Încearcă cu altul sau verifică dacă se deschide.";
}

/** Salvează rezultatul, apoi eliberează legătura temporară către el. */
function descarca(octeti: Uint8Array, nume: string): void {
  // Copie într-un tampon propriu: tipul `Uint8Array` al lui pdf-lib e deschis
  // și către `SharedArrayBuffer`, pe care `Blob` nu-l primește. Copia îl închide
  // la un `ArrayBuffer` adevărat, fără vreo conversie mincinoasă de tip.
  const tampon = new Uint8Array(octeti.length);
  tampon.set(octeti);
  const blob = new Blob([tampon.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nume;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Imediat ar întrerupe salvarea în unele browsere; o clipă e de ajuns.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
