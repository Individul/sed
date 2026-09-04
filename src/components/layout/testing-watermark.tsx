/**
 * Filigran diagonal peste o pagină: „ÎN TESTARE”.
 *
 * Rostul lui e ca cifrele să nu fie luate drept oficiale înainte de vreme. De
 * aceea stă peste toată pagina, nu într-o bandă sus: banda se citește o dată și
 * apoi se uită, iar de acolo încolo omul se uită doar la grafice. Filigranul
 * rămâne sub privire oriunde ar ajunge cu ea, inclusiv într-o captură de ecran
 * trimisă mai departe — și tocmai captura e felul în care o cifră neverificată
 * pleacă din aplicație și ajunge într-un raport.
 *
 * Deasupra conținutului, nu în spatele lui, deși „fundal” asta ar sugera:
 * cardurile au fundal opac, așa că un filigran dedesubt s-ar fi văzut doar prin
 * spațiile dintre ele — peticit, ca o eroare de afișare.
 *
 * Opacitatea a fost aleasă privind pagina, nu ghicind: 5,5% s-a dovedit prea
 * palid ca să fie observat, iar 11% se citește dintr-o privire fără să atingă
 * cifrele mari sau liniile graficelor. Dacă vreodată urcă mai sus, merită
 * verificat din nou peste un grafic, nu doar peste text.
 *
 * Făcut cu `<pattern>` SVG, nu cu rânduri de text: modelul se repetă singur pe
 * toată înălțimea paginii, oricât ar fi ea, fără să ghicim câte rânduri trebuie.
 *
 * `fill="currentColor"` ia culoarea din clasa Tailwind de mai jos, deci
 * filigranul urmează tema — altfel pe fundal închis rămânea o pată neagră.
 */

// Fix, nu generat: `useId` cere componentă client, iar paginile care îl folosesc
// sunt server components. Se ciocnește doar dacă filigranul apare de două ori pe
// aceeași pagină, ceea ce n-ar avea niciun sens.
const PATTERN_ID = "filigran-in-testare";

export function TestingWatermark({ text = "ÎN TESTARE" }: { text?: string }) {
  return (
    <svg
      aria-hidden
      // `pointer-events-none` e obligatoriu: altfel stratul ăsta ar înghiți
      // fiecare click de pe pagină. Părintele trebuie să fie `relative isolate`
      // — `isolate` ține `z-10` închis în pagină, ca dialogurile randate în
      // portal la nivelul lui `body` să rămână deasupra filigranului.
      className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none text-foreground/[0.11]"
    >
      <defs>
        <pattern
          id={PATTERN_ID}
          width="360"
          height="230"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-30)"
        >
          <text
            x="0"
            y="115"
            fill="currentColor"
            fontSize="32"
            fontWeight="700"
            letterSpacing="8"
          >
            {text}
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${PATTERN_ID})`} />
    </svg>
  );
}
