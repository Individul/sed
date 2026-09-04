import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";

/**
 * Ce au în comun cele trei grafice: paleta, cerneala, specificațiile marcajelor
 * și formatarea. Stau într-un singur loc tocmai ca graficele să nu se
 * depărteze unul de altul — un gri schimbat aici se schimbă peste tot, nu
 * într-un fișier din trei.
 *
 * Modulul e pur (constante și funcții), fără React și fără recharts.
 */

/**
 * Paleta categorică: opt sloturi în ordine fixă, definite în `globals.css`.
 * Ordinea nu e o alegere estetică, ci mecanismul de siguranță pentru
 * daltonism — validată pe suprafața cardului (alb): cea mai slabă pereche
 * vecină ΔE 9.1 sub protanopie și 19.6 la vedere normală. Nuanțele se atribuie
 * pe rând și **nu se reciclează niciodată**: al nouălea ar primi o culoare deja
 * folosită și cele două serii ar deveni imposibil de deosebit. De aceea
 * graficele taie la opt serii în loc să reia de la capăt.
 */
export const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

/** Câte serii colorate încap într-un grafic. Peste atât, culorile s-ar repeta. */
export const MAX_SERIES = PALETTE.length;

/** Suprafața pe care stă graficul: golul dintre marcaje și inelul punctelor. */
export const SURFACE = "hsl(var(--card))";
/** Cerneala textului secundar — etichete, axe, legendă. Niciodată culoarea seriei. */
export const INK_MUTED = "hsl(var(--muted-foreground))";
/** Linia de păr a grilei și a axelor: o treaptă față de suprafață, solidă. */
export const HAIRLINE = "hsl(var(--border))";

/**
 * Linia de referință (plafonul de detenție) nu e o serie: e reperul față de
 * care se citesc seriile. Poartă gri, nu o culoare din paletă, și **nu consumă
 * niciun slot** — altfel prima serie reală ar începe de la a doua nuanță.
 */
export const REFERENCE_INK = INK_MUTED;
export const REFERENCE_DASH = "5 4";

/** Specificațiile marcajelor, aceleași în toate graficele. */
export const LINE_WIDTH = 2;
export const DOT_RADIUS = 4;
export const ACTIVE_DOT_RADIUS = 5;
/** Golul în culoarea suprafeței care desparte marcajele lipite. */
export const SURFACE_GAP = 2;
/** Bara nu umple slotul: restul benzii rămâne aer. */
export const BAR_MAX_SIZE = 24;
/** Capătul dinspre valoare e rotunjit, baza rămâne dreaptă. */
export const BAR_RADIUS_TOP: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_RIGHT: [number, number, number, number] = [0, 4, 4, 0];

/** Cercul: 58% gaură. Restul se calculează din ea, ca raportul să nu se piardă. */
export const DONUT_CUTOUT = 0.58;
export const DONUT_OUTER_PERCENT = 82;
export const DONUT_INNER_PERCENT = DONUT_OUTER_PERCENT * DONUT_CUTOUT;

/** Înălțimile fixe ale containerelor, cu tot cu banda axei. */
export const CHART_HEIGHT = 320;
export const DONUT_HEIGHT = 260;
export const BARS_HEIGHT = 300;
/** Banda axei orizontale, socotită în înălțime ca etichetele de jos să încapă. */
export const HBAR_AXIS_BAND = 48;
/** Înălțimea unui rând de text din eticheta unei bare orizontale. */
export const HBAR_LINE_HEIGHT = 14;

/** Peste atâtea puncte, cercurile se string între ele; rămâne doar cel activ. */
export const DOTS_UP_TO = 24;

/** Textul axei: cerneală secundară, mic, discret. */
export const AXIS_TICK = { fill: INK_MUTED, fontSize: 11 };

const NUMBER_FORMAT = new Intl.NumberFormat("ro-RO");

/**
 * Cifra așa cum se citește. `null` rămâne „—": o valoare neraportată nu e zero
 * și nu are voie să se prefacă în unul.
 */
export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : NUMBER_FORMAT.format(value);
}

/** Perioada, scurt și în română: „3 iun. 2026". */
export function formatPeriod(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy", { locale: ro });
}

/**
 * Măsurile etichetelor de pe axa barelor orizontale.
 *
 * Recharts rupe singur eticheta în rânduri, pe cuvinte, dar nu la toată
 * lățimea axei, ci la vreo două treimi din ea. Cele două constante sunt
 * măsurate pe etichetele reale ale rapoartelor (11px): ~5 px pe caracter și
 * ruperea pe la 0,66 din lățime. Din ele iese și lățimea coloanei, și câte
 * rânduri să i se lase — ca eticheta să rămână **întreagă**, nu ciuntită.
 */
const LABEL_CHAR_WIDTH = 5;
const LABEL_WRAP_RATIO = 0.66;

/**
 * Lățimea coloanei de etichete: cât îi trebuie celei mai lungi ca să încapă pe
 * un rând, plafonată — altfel eticheta ar mânca graficul.
 */
export function labelAxisWidth(labels: string[]): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  const needed = (longest * LABEL_CHAR_WIDTH) / LABEL_WRAP_RATIO + 12;
  return Math.min(260, Math.max(96, Math.round(needed)));
}

/**
 * În câte rânduri se rupe cea mai lungă etichetă la lățimea dată. Din el iese
 * înălțimea rândului, ca eticheta ruptă în două să nu se atingă de vecina ei.
 */
export function labelLineCount(labels: string[], axisWidth: number): number {
  const perLine = Math.max(8, Math.floor((axisWidth * LABEL_WRAP_RATIO) / LABEL_CHAR_WIDTH));
  return labels.reduce((max, label) => Math.max(max, Math.ceil(label.length / perLine)), 1);
}

/** Înălțimea unui rând de bară orizontală: cât ține eticheta, dar nu sub bară. */
export function hbarRowHeight(lines: number): number {
  return Math.max(BAR_MAX_SIZE + 8, lines * HBAR_LINE_HEIGHT + 14);
}
