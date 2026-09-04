"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, ListTodo, Loader2, Search, Truck, UserSquare, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { searchAll } from "@/app/cautare/actions";
import {
  MIN_QUERY,
  countHits,
  type SearchGroup,
  type SearchKind,
  type StateTone,
} from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * Căutarea peste toate registrele, în capul paginii principale.
 *
 * Întrebarea la care răspunde e „ce avem pe X?", nu „unde e petiția asta" —
 * pentru a doua, fiecare modul își are filtrul lui. De aceea rezultatele stau
 * grupate pe registre: cine caută un nume vrea să vadă dintr-o privire în câte
 * locuri apare, nu o listă amestecată din care să deducă singur.
 */
/*
 * Culorile stărilor, aceleași ca în module.
 *
 * Nu e o paletă nouă: sarcinile își colorează deja stările așa în listă, iar
 * petițiile la fel. Un rezultat care arată ca registrul din care vine nu cere
 * învățat un al doilea cod de culori — iar panoul încetează să fie un perete
 * cenușiu în care toate rândurile par la fel.
 */
const TON: Record<StateTone, string> = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-700",
};

/** Iconița grupului: fiecare registru se recunoaște înainte de a-i citi numele. */
const ICOANA: Record<SearchKind, typeof ListTodo> = {
  sarcina: ListTodo,
  petitie: FileText,
  transfer: Truck,
  prevenit: UserSquare,
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [cauta, setCauta] = useState(false);
  const [deschis, setDeschis] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const camp = useRef<HTMLInputElement>(null);

  /*
   * Se așteaptă o clipă după ultima tastă.
   *
   * Fără pauza asta, „Țiganciuc" ar porni zece căutări, iar răspunsurile lor
   * s-ar putea întoarce în altă ordine decât au plecat — ultima tastă cu
   * rezultatele penultimei. `anulat` taie și răspunsul întârziat al unei
   * căutări care nu mai interesează.
   */
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setGroups([]);
      setCauta(false);
      return;
    }
    let anulat = false;
    setCauta(true);
    const t = setTimeout(() => {
      void searchAll(q).then((g) => {
        if (anulat) return;
        setGroups(g);
        setCauta(false);
      });
    }, 250);
    return () => {
      anulat = true;
      clearTimeout(t);
    };
  }, [query]);

  // Click în afară sau Escape închide panoul, dar nu golește ce ai scris:
  // cine îl redeschide caută de obicei același lucru.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setDeschis(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeschis(false);
      /*
       * „/" duce cursorul în căutare de oriunde din pagină.
       *
       * Nu și când se scrie deja undeva: într-un câmp de text, „/" e o bară
       * oblică, nu o comandă. Fără verificarea asta, orice dată scrisă
       * „12/09" ar fi sărit din câmp la jumătate.
       */
      if (e.key !== "/") return;
      const t = e.target as HTMLElement | null;
      const scrie =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t?.isContentEditable === true;
      if (scrie) return;
      e.preventDefault();
      camp.current?.focus();
      setDeschis(true);
    };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, []);

  const q = query.trim();
  const arataPanou = deschis && q.length >= MIN_QUERY;
  const total = countHits(groups);

  return (
    /*
     * Mai înaltă și cu umbră, nu doar un câmp printre altele.
     *
     * Prima formă se pierdea în pagină: chenar subțire pe fundal aproape alb,
     * într-un ecran plin de carduri. Cine n-o căuta anume n-o vedea. Acum stă ca
     * un obiect deosebit — iar semnul „/" din dreapta o arată drept ceea ce e,
     * și învață scurtătura fără să scrie nimeni un ajutor.
     */
    <div ref={wrap} className="relative mb-6">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={camp}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setDeschis(true);
        }}
        onFocus={() => setDeschis(true)}
        placeholder="Caută un nume în toate registrele — sarcini, petiții, transferuri, preveniți"
        aria-label="Caută în toate registrele"
        className="h-12 rounded-xl border-input bg-card pl-12 pr-12 text-[15px] shadow-sm"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setDeschis(false);
            camp.current?.focus();
          }}
          aria-label="Șterge căutarea"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:block"
        >
          /
        </kbd>
      )}

      {arataPanou && (
        <div className="absolute z-20 mt-2 max-h-[28rem] w-full overflow-y-auto rounded-xl border bg-card shadow-lg">
          {cauta && groups.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Se caută…
            </p>
          ) : total === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Nimic pentru „{q}”.
            </p>
          ) : (
            <div className="divide-y">
              {groups.map((g) => (
                <div key={g.kind} className="py-1.5">
                  <div className="flex items-center gap-1.5 px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {(() => {
                      const Ico = ICOANA[g.kind];
                      return <Ico className="h-3.5 w-3.5" aria-hidden />;
                    })()}
                    {g.label}
                  </div>
                  {g.hits.map((h) => (
                    <Link
                      key={h.id}
                      href={h.href}
                      onClick={() => setDeschis(false)}
                      className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-accent"
                    >
                      {/* Starea la dreapta, într-o coloană a ei: la toate
                          rândurile în același loc, deci ochiul o poate coborî
                          pe verticală în loc s-o caute la alt capăt de frază. */}
                      <div className={cn("min-w-0 flex-1", h.finished && "opacity-60")}>
                        <div className="truncate text-[13px]">{h.title}</div>
                        {h.detail && (
                          <div className="truncate text-xs text-muted-foreground">{h.detail}</div>
                        )}
                      </div>
                      {h.state && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                            TON[h.tone],
                          )}
                        >
                          {h.state}
                        </span>
                      )}
                    </Link>
                  ))}
                  {g.more > 0 && (
                    <p className="px-4 py-1 text-xs text-muted-foreground">
                      încă {g.more} — caută în modul pentru toate
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
