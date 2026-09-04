import { addDays, startOfDay } from "date-fns";
import { parseISODate, toISODate, todayInChisinau, type DateRange } from "./periods";
import { aggregate, type TransferCounts } from "./transfers";

/**
 * Săptămâna pe care o acoperă raportul: marțea trecută → luni, inclusiv.
 *
 * Marțea în care se prezintă raportul intră în săptămâna URMĂTOARE. Altfel
 * aceeași marți ar apărea în două rapoarte consecutive, iar un transfer de
 * marți s-ar număra de două ori. În plus, dimineața raportului n-ar mai
 * depinde de date care abia se întâmplă.
 *
 * Deschis luni, arată tot săptămâna de dinainte: ziua curentă nu s-a încheiat.
 *
 * `today` e o zi calendaristică, nu un instant: din el se citește numai ziua
 * săptămânii. De aceea implicitul e `todayInChisinau()`, nu `new Date()` —
 * ceasul serverului e UTC, iar între miezul nopții de la noi și cel de la
 * Greenwich ziua de aici e încă cea de ieri, adică raportul săptămânii
 * trecute fix în dimineața prezentării.
 */
export function reportWeek(today: Date = todayInChisinau()): DateRange {
  const t = startOfDay(today);
  // Câte zile de la ultima marți (0 dacă azi e marți). getDay(): 0=duminică.
  const deLaMarti = (t.getDay() - 2 + 7) % 7;
  const martiCurenta = addDays(t, -deLaMarti);
  // Marțea curentă aparține săptămânii care abia începe, deci se ia cea dinainte.
  const from = addDays(martiCurenta, -7);
  return { from, to: addDays(from, 6) };
}

/** Săptămâna vecină, pentru navigarea înapoi/înainte. */
export function shiftWeek(week: DateRange, weeks: number): DateRange {
  return { from: addDays(week.from, weeks * 7), to: addDays(week.to, weeks * 7) };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Săptămâna cerută prin adresă, adusă la marți→luni.
 *
 * `reportWeek(zi)` dă săptămâna încheiată ÎNAINTEA acelei zile, deci un pas
 * înainte scoate chiar săptămâna în care cade ziua din adresă. Așa un link
 * scris de mână cu o zi de joi nimerește intervalul corect, în loc să dea o
 * eroare pentru care n-are nimeni ce face.
 *
 * Mai departe de săptămâna curentă nu se merge: acolo n-ar fi un raport, ci
 * șapte zile care încă nu s-au întâmplat — patru zerouri pe care nici măcar
 * `missingWorkdays` nu le-ar semnala, fiindcă o zi viitoare nu poate lipsi.
 *
 * Stă aici, nu în pagină, fiindcă o citește și ruta care scoate PDF-ul. Cele
 * două normalizări scrise separat s-ar despărți la prima corectură, iar
 * despărțirea n-ar arăta ca o eroare: butonul „Descarcă PDF" ar întoarce
 * liniștit un raport pe altă săptămână decât cea de pe ecran, cu cifre
 * perfect corecte pentru intervalul greșit.
 *
 * Primește și `string[]`: dacă parametrul apare de două ori în adresă, Next îl
 * dă paginii ca listă, în timp ce `URLSearchParams.get()` dă doar prima
 * valoare. Netezirea se face aici, nu la fiecare apelant — altfel exact
 * despărțirea de mai sus s-ar întâmpla din nou, de data asta printr-un tip.
 */
export function readWeek(
  value: string | string[] | null | undefined,
  current: DateRange,
): DateRange {
  const cerut = Array.isArray(value) ? value[0] : value;
  if (!cerut || !ISO.test(cerut)) return current;
  const zi = parseISODate(cerut);
  /*
   * Șablonul de mai sus numără cifrele, nu verifică zilele: „2026-02-30" trece
   * prin el, iar V8 rostogolește data peste capătul lunii și dă 2 martie. Ar
   * ieși un raport plin de cifre reale pentru o săptămână pe care n-a cerut-o
   * nimeni — și, spre deosebire de o adresă respinsă, nimic nu s-ar vedea.
   * Ziua se scrie la loc și se compară cu ce s-a cerut: dacă nu iese identic,
   * adresa e greșită, iar săptămâna curentă e singurul răspuns onest.
   */
  if (Number.isNaN(zi.getTime()) || toISODate(zi) !== cerut) return current;
  const ceruta = shiftWeek(reportWeek(zi), 1);
  return ceruta.from > current.from ? current : ceruta;
}

/**
 * Rândurile din care ies cifrele, așa cum vin din bază.
 *
 * Tipuri structurale, nu `Transfer`/`Hearing`/`Release`: aici se citesc doar
 * coloanele scrise mai jos, iar un test n-ar trebui să construiască un rând
 * întreg, cu `id` și `created_at`, ca să verifice o adunare.
 */
export interface WeeklyRows {
  transfers: (TransferCounts & { transfer_date: string })[];
  /** `tc_total` e coloană generată în Postgres — se citește, nu se recompune. */
  hearings: { session_date: string; tc_total: number; tc_amanate: number }[];
  releases: { release_date: string; count: number }[];
}

/** Cele patru cifre cerute de conducere, plus amânatele de sub teleconferințe. */
export interface WeeklyFigures {
  plecati: number;
  sositi: number;
  teleconferinte: number;
  /** Din teleconferințele de mai sus, câte s-au amânat. */
  amanate: number;
  eliberati: number;
}

/**
 * Cifrele săptămânii, dintr-un singur loc.
 *
 * Pagina și PDF-ul aduc rândurile fiecare pe cont propriu, dar le adună aici,
 * amândouă. A doua socoteală, oriunde ar fi scrisă, se desincronizează de prima
 * la prima modificare — s-a întâmplat deja în proiectul ăsta, cu restanțele:
 * „8" într-un loc, „1" în altul, aceeași zi. O hârtie tipărită care nu se
 * potrivește cu ecranul e mai rea decât lipsa raportului.
 *
 * Filtrarea pe interval se face aici, nu la apelant: `getTransfers()` aduce
 * registrul întreg, iar o zi scăpată din afara săptămânii nu se vede în total.
 * Interogările pe ședințe și eliberări filtrează deja în bază — repetarea nu
 * costă nimic și face funcția adevărată pentru orice listă i-ai da.
 *
 * Comparația se face pe text AAAA-LL-ZZ, exact ca `gte`/`lte` în Postgres:
 * formatul se sortează alfabetic la fel ca cronologic, deci nu mai e nevoie ca
 * fiecare rând să treacă printr-un `Date`.
 */
export function weeklyFigures(week: DateRange, rows: WeeklyRows): WeeklyFigures {
  const from = toISODate(week.from);
  const to = toISODate(week.to);
  const inWeek = (zi: string) => zi >= from && zi <= to;

  const transferuri = aggregate(rows.transfers.filter((t) => inWeek(t.transfer_date)));
  const sedinte = rows.hearings.filter((h) => inWeek(h.session_date));

  return {
    plecati: transferuri.plecati,
    sositi: transferuri.sositi,
    teleconferinte: sedinte.reduce((a, h) => a + (h.tc_total || 0), 0),
    amanate: sedinte.reduce((a, h) => a + (h.tc_amanate || 0), 0),
    eliberati: rows.releases
      .filter((r) => inWeek(r.release_date))
      .reduce((a, r) => a + (r.count || 0), 0),
  };
}
