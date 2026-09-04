/**
 * Noutățile arătate pe pagina principală.
 *
 * Se adaugă o intrare la fiecare livrare, scrisă pentru utilizator, nu pentru
 * programator: ce se schimbă pentru el, nu ce s-a modificat în cod. Cea mai
 * recentă stă prima — de ea depinde și marcajul „nou".
 */
export interface ChangelogEntry {
  /** ISO (AAAA-LL-ZZ). Se compară ca text, deci formatul e obligatoriu. */
  date: string;
  text: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-09-04",
    text: "Aplicația s-a făcut mai iute. Bara de sus nu se mai șterge și nu se mai reface la fiecare clic — rămâne pe ecran, iar sub ea apare pe loc un schelet cât se aduc datele, în loc ca pagina veche să stea neclintită. Registrul de petiții se deschide acum pe cele în examinare: din 348 de petiții, 335 sunt soluționate, adică arhivă, iar browserul le desena pe toate ca să arate 13 rânduri de lucru; un clic pe „Toate” arată registrul întreg, ca înainte. Și nu se mai trimite profilul responsabilului repetat în fiecare rând — cântărea 67 KB la fiecare deschidere, deși profilurile sunt patru cu totul.",
  },
  {
    date: "2026-09-04",
    text: "Uneltele PDF au venit în aplicație, sub „Unelte” în bara de sus: unește mai multe PDF-uri într-unul singur, scoate paginile care nu trebuie sau ia numai paginile care trebuie. La unire, ordinea o schimbi trăgând fișierul de mânerul din stânga, ca înainte. Paginile se scriu tot ca până acum — răzlețe cu virgulă, intervale cu linie: 1,3,5-7 — iar sub câmp se vede pe loc ce rămâne. O schimbare față de varianta de pe serverul vechi: fișierul nu se mai încarcă nicăieri, tot lucrul se face pe calculatorul tău, deci dosarele cu date personale nu mai pleacă din secție. Nici mărimea nu mai e plafonată; un dosar de 1200 de pagini se taie în câteva sutimi de secundă.",
  },
  {
    date: "2026-09-04",
    text: "Calculatoarele penale se deschid acum din meniul „Unelte” din bara de sus, de pe orice pagină — nu doar de acasă. Până acum, ca să afli un termen în mijlocul unei petiții, trebuia să te întorci pe pagina principală și pe urmă să-ți cauți din nou locul. Sub „Unelte” stau „Calculator termen și clasificare” și „Concurs sau cumul de sentințe”; butoanele lor de lângă salut au dispărut. „Raportul de marți” a rămas unde era.",
  },
  {
    date: "2026-09-04",
    text: "Unealtă nouă, încă în testare: „Concurs sau cumul de sentințe”. Când un condamnat primește încă o sentință, spune dacă temeiul e art. 84 alin. (4) sau art. 85. Le desparte o singură întrebare: era omul deja condamnat când a săvârșit fapta? Deci data săvârșirii față de data pronunțării primei sentințe. Sentințele pot fi oricâte — se așază singure în ordinea pronunțării, iar temeiul se hotărăște pentru fiecare, așa că într-un lanț unele pot fi concurs și altele cumul. Arată și motivul, în datele introduse, și ce urmează din temei: la art. 84 durata executată intră în termen, la art. 85 partea neexecutată se adaugă. Pedeapsa definitivă rămâne a instanței.",
  },
  {
    date: "2026-09-04",
    text: "Catalogul de infracțiuni a fost refăcut din tabelul Codului penal și are acum 793 de intrări pe 327 de articole, față de 664 pe 250. Lipseau, fără să se vadă, trei feluri de intrări: articolele cu un singur alineat nenumerotat — printre ele art. 342, cu detențiune pe viață, și art. 338 și 340, cu 20 de ani — faptele pedepsite cu amendă, precum art. 217 alin. 1, și cele cu muncă neremunerată. Tot atunci s-au îndreptat 17 intrări de 17–20 de ani trecute drept „excepțional de grave”: după art. 16 alin. (6) excepțional de gravă e numai fapta pedepsită cu detențiune pe viață, deci sunt deosebit de grave. Fracțiile art. 91 și 92 rămân aceleași; se schimbă numai denumirea categoriei.",
  },
  {
    date: "2026-09-04",
    text: "La clasificare se pot alege și articolele cu indice — art. 217/1, 245/10 și celelalte 90 din Cod. Se scriu cu bară, iar sub câmp apar toate articolele cu același număr, de unde se aleg dintr-un click. Până acum nu se găseau deloc, fiindcă în catalog stau scrise cu exponent, care nu se poate tasta; cine căuta art. 217/1 alin. 4 și adăuga art. 217 alin. 4 primea „gravă” în loc de „deosebit de gravă”, deci altă fracție și altă dată.",
  },
  {
    date: "2026-09-04",
    text: "Clasificarea infracțiunii a coborât pe aceeași pagină cu calculatorul de termen, sub el. Pedeapsa scrisă sus se folosește mai departe, deci fracțiile pentru art. 91 și 92 nu mai apar doar ca numere, ci și ca date: când se poate cere liberarea condiționată și când înlocuirea părții neexecutate, cu arestul preventiv scăzut din amândouă. Dacă vrei doar categoria, lași datele de sus goale.",
  },
  {
    date: "2026-09-04",
    text: "Calculatorul de termen a ieșit din fereastră pe pagină proprie. Cele două socoteli — din data începerii și reducerea de termen — stau alături, deci nu se mai comută între ele. Se ajunge la el tot de pe pagina principală, din butonul „Calculator termen și clasificare” de lângă salut.",
  },
  {
    date: "2026-09-02",
    text: "Două unelte noi pe pagina principală: „Calculator termen” — sfârșitul pedepsei din data începerii, cu arestul preventiv scăzut și cu reducerile dispuse prin încheiere — și „Clasificare infracțiune” — categoria după art. 16 CP RM și fracțiile pentru art. 91 și 92.",
  },
  {
    date: "2026-09-02",
    text: "Pe pagina principală e o căutare peste toate registrele deodată. Scrii un nume și vezi unde apare — sarcini, petiții, planificare transferuri, preveniți — cu eticheta sau obiectul dedesubt și starea în dreapta: în lucru, în așteptare, finalizat, în examinare, soluționat. Diacriticele nu contează: „Tiganciuc” îl găsește pe „Țiganciuc”. Tasta „/” duce cursorul în căutare de oriunde.",
  },
  {
    date: "2026-09-02",
    text: "Registrul ține acum ambele categorii: preveniți și inculpați. Se bifează măsura preventivă, iar categoria se citește din ea — cine are măsură e prevenit, ceilalți inculpați. Cifrele de sus arată ambele împărțiri.",
  },
  {
    date: "2026-09-02",
    text: "La planificarea transferurilor se poate alege temeiul: ședință de judecată sau decizie. La ședință transferul se face în ultima zi programată dinaintea ei; la decizie, în prima zi programată de la data parvenirii.",
  },
  {
    date: "2026-09-01",
    text: "Raportul de ședințe se poate muta pe orice perioadă din trecut, cu săgețile de lângă interval — direct pe pagina Ședințe, nu doar în versiunea de tipărit. Până acum arăta doar perioada curentă, deci pe 1 septembrie nu aveai cum să vezi totalul lunii august.",
  },
  {
    date: "2026-08-08",
    text: "La înregistrarea unei petiții noi, responsabilul se completează singur după litera cu care începe numele petiționarului. Se vede în formular înainte de salvare și se poate schimba oricând.",
  },
  {
    date: "2026-08-08",
    text: "Notificarea despre o petiție o deschide direct pe aceea. Până acum te lăsa în registru, să o cauți singur printre toate.",
  },
  {
    date: "2026-08-08",
    text: "Aplicația folosește acum ora Republicii Moldova. Până acum mergea pe ora serverului, cu trei ore în urmă, așa că noaptea până la ora 3 credea că e încă ziua de ieri — și arăta termenele mai puțin urgente decât erau.",
  },
  {
    date: "2026-08-07",
    text: "Notificările pot apărea și ca anunț în colțul ecranului, ca la poșta electronică. Se pornesc din clopoțelul mic de lângă titlul „Notificări” și funcționează cât timp aplicația e deschisă într-o filă.",
  },
  {
    date: "2026-08-07",
    text: "Banda de termene are o treaptă nouă: în chiar ziua termenului devine portocalie, între galbenul „se apropie” și roșul „ai depășit”.",
  },
  {
    date: "2026-08-07",
    text: "Aplicația are pictogramă proprie: fila din browser se recunoaște acum dintr-o privire printre celelalte.",
  },
  {
    date: "2026-08-06",
    text: "Pagina de statistici poartă în diagonală însemnul „în testare”, ca cifrele de acolo să nu fie preluate ca oficiale până la verificare.",
  },
  {
    date: "2026-08-06",
    text: "Sarcinile și petițiile se citesc acum și pe monitoare mici: coloanele nu se mai suprapun, iar rezumatul din dreapta coboară sub tabel când ecranul e prea îngust pentru amândouă.",
  },
  {
    date: "2026-08-03",
    text: "Defalcarea pe responsabili se vede de către toți, nu doar de administrator — la sarcini și la petiții.",
  },
  {
    date: "2026-08-03",
    text: "Registru nou: inculpații cu tip de penitenciar stabilit. Cine devine condamnat iese din listă, dar rămâne în evidență.",
  },
  {
    date: "2026-08-03",
    text: "Informările periodice către ANP au evidență proprie: termenul se recalculează singur, iar cele apropiate sau restante apar pe pagina principală.",
  },
  {
    date: "2026-08-03",
    text: "Copia de siguranță se face automat în fiecare noapte, cu o a doua rulare de rezervă dacă prima nu reușește.",
  },
  {
    date: "2026-07-31",
    text: "Raportul de ședințe are versiune de tipărit: se alege perioada și se tipărește sau se salvează ca PDF.",
  },
  {
    date: "2026-07-31",
    text: "Planificarea transferurilor: persoanele cu ședințe se grupează singure pe ziua de transfer, iar la amânare însemnarea se mută automat.",
  },
  {
    date: "2026-07-31",
    text: "La transferuri, „Adaugă transfer” se deschide pe ziua programată rămasă necompletată, nu pe ziua curentă.",
  },
  {
    date: "2026-07-31",
    text: "Modul nou, încă în testare: transferuri — deținuții transferați între penitenciare, în zilele programate din lună.",
  },
  {
    date: "2026-07-30",
    text: "Auditul se poate filtra pe module — sarcini, petiții, ședințe, utilizatori — iar fiecare modul are iconița lui.",
  },
  {
    date: "2026-07-30",
    text: "Petițiile intră în audit: se vede cine a atribuit, a soluționat, a mutat data înregistrării sau a șters un fișier.",
  },
  {
    date: "2026-07-30",
    text: "La ședințe, raportul semnalează zilele lucrătoare rămase fără date, cu link direct spre ele.",
  },
  {
    date: "2026-07-30",
    text: "Modul nou, încă în testare: ședințe de judecată — evidența zilnică, cu rapoarte pe zi, săptămână, lună, trimestru, semestru și an.",
  },
  {
    date: "2026-07-30",
    text: "Pe pagina principală, administratorul vede toate cifrele defalcate pe fiecare responsabil.",
  },
  {
    date: "2026-07-30",
    text: "Sarcinile plecate la instanță trec „În așteptare”: nu mai apar ca restante, dar se vede de câte zile durează.",
  },
  {
    date: "2026-07-30",
    text: "Modul nou, încă în testare: statistici — rapoartele se văd ca grafice, pe perioade.",
  },
  {
    date: "2026-07-29",
    text: "Petiția se deschide dintr-un click pe agrafă, direct din registru.",
  },
  {
    date: "2026-07-29",
    text: "Sarcinile și petițiile se deschid filtrate pe ce ți-e atribuit; filtrul se scoate dintr-un click.",
  },
  {
    date: "2026-07-29",
    text: "Petițiile trimit notificări la înregistrare, atribuire, soluționare și modificare.",
  },
  {
    date: "2026-07-29",
    text: "Obiectul petiției se completează din butoane, cu mai multe alegeri deodată.",
  },
  {
    date: "2026-07-29",
    text: "Fișierul petiției se atașează imediat după înregistrare, fără a o redeschide.",
  },
  {
    date: "2026-07-29",
    text: "Registrul a fost completat cu petițiile din evidența veche, cu tot cu fișierele lor.",
  },
  {
    date: "2026-07-29",
    text: "Pe pagina principală, sub cifrele tale apare și totalul secției.",
  },
  {
    date: "2026-07-28",
    text: "La petiții se pot atașa fișiere — PDF, JPG sau PNG, până la 10 MB.",
  },
  {
    date: "2026-07-28",
    text: "Modul nou: evidența petițiilor, cu termen de răspuns la 27 de zile.",
  },
  {
    date: "2026-07-28",
    text: "Pagina principală adună dintr-o privire cifrele pe sarcini și petiții.",
  },
];

/** Câte se arată pe pagina principală; restul stau în /noutati. */
export const HUB_CHANGELOG_COUNT = 4;

/**
 * E intrarea nouă față de ultima vizită?
 *
 * La prima vizită (`lastSeen` null) nimic nu e „nou": altfel un utilizator care
 * intră prima oară ar fi întâmpinat de un perete de marcaje.
 */
export function isNewSince(entryDate: string, lastSeen: string | null): boolean {
  return lastSeen !== null && entryDate > lastSeen;
}
