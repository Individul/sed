import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Pictograma aplicației are un fel de a se strica fără să spună nimic.
 *
 * `src/app/icon.svg` e legat de Next în <head>, iar ruta răspunde 200 cu
 * `image/svg+xml` chiar și când fișierul e XML invalid — serverul îl trimite,
 * browserul refuză să-l deseneze, iar în filă nu apare nimic. Nici build-ul,
 * nici tsc, nici lint nu se uită înăuntrul lui.
 *
 * S-a și întâmplat: comentariul explica numele culorii din temă scriindu-l cu
 * prefixul de variabilă CSS, iar cele două cratime sunt interzise de XML în
 * interiorul unui comentariu. Testul ăsta e ce ar fi prins-o.
 */
const APP = join(dirname(fileURLToPath(import.meta.url)), "..", "app");

describe("icon.svg", () => {
  const svg = readFileSync(join(APP, "icon.svg"), "utf8");

  it("nu conține două cratime în interiorul unui comentariu", () => {
    // XML interzice „--” în corpul comentariului; doar delimitatorii au voie.
    for (const [, corp] of svg.matchAll(/<!--([\s\S]*?)-->/g)) {
      expect(corp).not.toContain("--");
    }
  });

  it("are un singur comentariu închis corect", () => {
    expect(svg.match(/<!--/g)?.length ?? 0).toBe(svg.match(/-->/g)?.length ?? 0);
  });

  it("desenează ceva: are pătratul de fundal și trăsăturile", () => {
    // Fără asta, un fișier golit de conținut ar trece testele de mai sus.
    expect(svg).toMatch(/<rect[^>]*fill="#212a36"/);
    expect(svg.match(/<path/g)?.length).toBe(3);
  });
});
