import { defineConfig } from "vitest/config";

/**
 * Testele rulează pe UTC, ca serverul.
 *
 * Nu e o preferință, ci condiția ca testele de fus orar să însemne ceva:
 * mașinile de aici stau pe Europe/Bucharest, care are exact același decalaj ca
 * Europe/Chisinau, tot anul. Pe un ceas local o citire greșită a zilei — cea
 * de pe ceasul serverului în loc de cea de la Chișinău — dă același rezultat
 * ca cea corectă, deci `todayInChisinau` ar putea fi stricată fără ca vreun
 * test să se supere. Pe Vercel, unde ceasul e UTC, aceeași greșeală mută ziua.
 *
 * Se scrie în `process.env` înainte de pornirea proceselor de test, ca ele să
 * moștenească fusul de la naștere: pe Windows, Node a ignorat multă vreme
 * variabila `TZ` schimbată din mers, iar proiectul ăsta s-a ars deja o dată de
 * la asta. `src/lib/periods.test.ts` verifică explicit că fusul a prins,
 * tocmai ca o regresie de-a lui Node să nu treacă neobservată.
 */
process.env.TZ = "UTC";

// Vitest rulează doar testele unitare din src/. Testele E2E (e2e/*.spec.ts)
// sunt Playwright și se rulează separat cu `npm run test:e2e`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
