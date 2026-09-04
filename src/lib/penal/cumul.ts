/**
 * Care articol se aplică la a doua sentință: art. 84 alin. (4) sau art. 85.
 *
 * Cele două se citesc ușor greșit fiindcă amândouă vorbesc despre un om care
 * are deja o sentință și mai primește una. Ce le desparte nu e scris nicăieri
 * ca regulă, ci iese din câte un cuvânt al fiecăruia:
 *
 *  — art. 84 alin. (4): „...vinovată şi de comiterea unei alte infracţiuni
 *    săvârșite ÎNAINTE de pronunţarea sentinţei în prima cauză";
 *  — art. 85 alin. (1): „...DUPĂ pronunțarea sentinței, dar înainte de
 *    executarea completă a pedepsei, condamnatul a săvârșit o nouă infracțiune".
 *
 * Deci hotărăște data săvârșirii față de data pronunțării, nu gravitatea, nu
 * ordinea în care au venit sentințele și nici când s-a descoperit fapta.
 *
 * Urmările sunt deosebite, de aceea alegerea contează: la art. 84 durata deja
 * executată INTRĂ în termenul definitiv, la art. 85 partea neexecutată SE ADAUGĂ
 * la pedeapsa nouă. Plafoanele sunt și ele altele.
 */

export type Temei = "art84" | "art85" | "niciunul";

export interface DateCumul {
  /** Când a fost săvârșită fapta pentru care vine a doua sentință. */
  savarsire: Date;
  /** Când s-a pronunțat sentința în prima cauză. */
  pronuntare: Date;
  /**
   * Când s-a încheiat executarea primei pedepse. Poate lipsi — atunci art. 85
   * se dă sub condiția că pedeapsa nu era executată integral.
   */
  sfarsitPrimei?: Date | null;
}

export interface RezultatCumul {
  temei: Temei;
  /**
   * Fapta e săvârșită chiar în ziua pronunțării. Data singură nu spune dacă a
   * fost înainte sau după citirea sentinței, deci răspunsul trebuie privit cu
   * ora în față.
   */
  aceeasiZi: boolean;
}

/** Ziua calendaristică, la amiază: ora din date nu trebuie să hotărască nimic. */
function zi(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
}

/**
 * Temeiul aplicabil.
 *
 * `niciunul` nu e un eșec al socotelii, ci un răspuns: dacă fapta e săvârșită
 * după ce pedeapsa fusese executată integral, nu mai e nici concurs, nici cumul
 * — e o cauză de sine stătătoare. Art. 85 cere anume ca fapta să fie săvârșită
 * „înainte de executarea completă a pedepsei".
 */
export function temeiCumul({ savarsire, pronuntare, sfarsitPrimei }: DateCumul): RezultatCumul {
  const s = zi(savarsire);
  const p = zi(pronuntare);

  if (s < p) return { temei: "art84", aceeasiZi: false };

  const aceeasiZi = s === p;

  // Ultima zi de executare se socotește executată în întregime abia la
  // sfârșitul ei, deci o faptă săvârșită chiar atunci e încă „înainte de
  // executarea completă".
  if (sfarsitPrimei && s > zi(sfarsitPrimei)) {
    return { temei: "niciunul", aceeasiZi };
  }

  return { temei: "art85", aceeasiZi };
}

/** O sentință din lanț, așa cum o introduce omul. */
export interface Sentinta {
  /** Data pronunțării. Ea dă ordinea în lanț. */
  pronuntare: Date;
  /** Data săvârșirii faptei judecate prin ea. */
  savarsire: Date;
  /** Sfârșitul pedepsei stabilite prin ea, dacă e cunoscut. */
  sfarsit?: Date | null;
}

export interface PasLant {
  /** A câta e în lanț, numărând de la 1 după data pronunțării. */
  numar: number;
  sentinta: Sentinta;
  /** Sentința întâi — cea față de care se hotărăște „înainte" sau „după". */
  prima: Sentinta;
  /**
   * Sentința a cărei pedeapsă se executa la data faptei, dacă a fost vreuna.
   * Ea dă condiția art. 85: fapta trebuie săvârșită înainte de executarea
   * completă.
   */
  inExecutare: Sentinta | null;
  /** A câta e aceea în lanț, pentru ce se scrie pe ecran. */
  numarInExecutare: number | null;
  temei: Temei;
  aceeasiZi: boolean;
  /**
   * Fapta e datată după propria sentință — imposibil, deci o greșeală de
   * introducere. Se semnalează, nu se corectează: nu se poate ști care dintre
   * cele două date e cea greșită.
   */
  dataImposibila: boolean;
}

/**
 * Temeiul la fiecare sentință care se adaugă celor dinainte.
 *
 * Ancora e PRIMA sentință, nu cea dinaintea fiecăreia. Art. 84 alin. (4) o
 * numește: „săvârșite înainte de pronunţarea sentinţei în prima cauză". Iar
 * întrebarea de fond e chiar asta — era omul deja condamnat când a săvârșit
 * fapta? Dacă da, art. 85; dacă nu, concurs. Cum sentințele stau în ordinea
 * pronunțării, „după vreo sentință" înseamnă „după prima".
 *
 * Condiția a doua a art. 85 — fapta să fie săvârșită înainte de executarea
 * completă — se cântărește însă față de pedeapsa care se executa CHIAR ATUNCI,
 * adică cea stabilită de ultima sentință pronunțată înaintea faptei. Prima poate
 * fi de mult încheiată, fără ca omul să fi ieșit din executare.
 *
 * Sortarea se face aici, nu se cere de la om: sentințele vin din dosar în
 * ordinea în care s-au găsit, nu în cea a calendarului.
 */
export function lantulTemeiurilor(sentinte: Sentinta[]): PasLant[] {
  const ordonate = [...sentinte].sort((a, b) => zi(a.pronuntare) - zi(b.pronuntare));
  const prima = ordonate[0];
  if (!prima) return [];

  return ordonate.slice(1).map((sentinta, i) => {
    // Doar sentințele dinaintea ei: la data faptei, cele de după nu existau.
    const anterioare = ordonate.slice(0, i + 1);
    // Căutare de la coadă, cu buclă: `findLastIndex` cere un browser destul de
    // nou, iar pe calculatoarele secției nu se știe care e.
    let indexInExecutare = -1;
    for (let j = anterioare.length - 1; j >= 0; j--) {
      if (zi(anterioare[j].pronuntare) <= zi(sentinta.savarsire)) {
        indexInExecutare = j;
        break;
      }
    }
    const inExecutare = indexInExecutare >= 0 ? anterioare[indexInExecutare] : null;

    const { temei, aceeasiZi } = temeiCumul({
      savarsire: sentinta.savarsire,
      pronuntare: prima.pronuntare,
      sfarsitPrimei: inExecutare?.sfarsit,
    });

    return {
      numar: i + 2,
      sentinta,
      prima,
      inExecutare,
      numarInExecutare: indexInExecutare >= 0 ? indexInExecutare + 1 : null,
      temei,
      aceeasiZi,
      dataImposibila: zi(sentinta.savarsire) > zi(sentinta.pronuntare),
    };
  });
}
