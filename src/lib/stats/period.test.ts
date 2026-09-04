import { describe, it, expect } from "vitest";
import { guessPeriod } from "./period";

describe("guessPeriod — fișierele reale", () => {
  it("ia data explicită din numele fișierului", () => {
    expect(guessPeriod("01.06.2026_r_lunar.xlsx")).toEqual({
      date: "2026-06-01",
      type: "lunar",
    });
    expect(guessPeriod("01.06.2026_liberați.xlsx")).toEqual({
      date: "2026-06-01",
      type: "lunar",
    });
  });

  it("găsește data și după un underscore sau un an", () => {
    expect(guessPeriod("Amnistia_2016_01.06.2026.xlsx")).toEqual({
      date: "2026-06-01",
      type: "lunar",
    });
    expect(guessPeriod("Amnistia_2021_01.06.2026.xlsx")).toEqual({
      date: "2026-06-01",
      type: "lunar",
    });
    expect(guessPeriod("Tabel_comisia_penitenciară_01.06.2026.xlsx")).toEqual({
      date: "2026-06-01",
      type: "lunar",
    });
  });

  it("traduce „<lună> <an>” în prima zi a lunii", () => {
    expect(guessPeriod("Tabel sedinte judecată iunie 2026.xlsx")).toEqual({
      date: "2026-06-01",
      type: "lunar",
    });
  });

  it("întoarce null când numele are doar anul", () => {
    expect(guessPeriod("Gratierea  2026.xlsx")).toBeNull();
    expect(guessPeriod("MC_2026.xlsx")).toBeNull();
  });

  it("întoarce null când nu e nicio dată", () => {
    expect(guessPeriod("ceva fără dată.xlsx")).toBeNull();
  });
});

describe("guessPeriod — dd.mm.yyyy", () => {
  it("prinde data oriunde în nume", () => {
    expect(guessPeriod("Raport 31.12.2025 final.xlsx")?.date).toBe("2025-12-31");
    expect(guessPeriod("raport-01.01.2024.xlsx")?.date).toBe("2024-01-01");
    expect(guessPeriod("29.02.2024_bisect.xlsx")?.date).toBe("2024-02-29");
  });

  it("ia prima dată validă dintr-un interval", () => {
    expect(guessPeriod("Darea de seamă 01.06.2026-30.06.2026.xlsx")?.date).toBe(
      "2026-06-01",
    );
  });

  it("respinge datele imposibile", () => {
    expect(guessPeriod("32.13.2026.xlsx")).toBeNull();
    expect(guessPeriod("00.00.2026.xlsx")).toBeNull();
    expect(guessPeriod("29.02.2025.xlsx")).toBeNull();
    expect(guessPeriod("31.04.2026.xlsx")).toBeNull();
  });

  it("sare peste data imposibilă și o ia pe următoarea validă", () => {
    expect(guessPeriod("32.13.2026 dar și 05.03.2026.xlsx")?.date).toBe(
      "2026-03-05",
    );
  });

  it("nu confundă un număr lipit de dată cu ziua", () => {
    expect(guessPeriod("Anexa 123.06.2026.xlsx")).toBeNull();
  });

  it("marchează totul ca „lunar” — tipul se confirmă în interfață", () => {
    expect(guessPeriod("01.06.2026_r_lunar.xlsx")?.type).toBe("lunar");
    expect(guessPeriod("Tabel sedinte judecată iunie 2026.xlsx")?.type).toBe(
      "lunar",
    );
  });
});

describe("guessPeriod — nume de lună", () => {
  const luni: [string, string][] = [
    ["ianuarie", "01"],
    ["februarie", "02"],
    ["martie", "03"],
    ["aprilie", "04"],
    ["mai", "05"],
    ["iunie", "06"],
    ["iulie", "07"],
    ["august", "08"],
    ["septembrie", "09"],
    ["octombrie", "10"],
    ["noiembrie", "11"],
    ["decembrie", "12"],
  ];

  it("cunoaște toate cele 12 luni", () => {
    for (const [luna, mm] of luni) {
      expect(guessPeriod(`Tabel ${luna} 2026.xlsx`)).toEqual({
        date: `2026-${mm}-01`,
        type: "lunar",
      });
    }
  });

  it("nu se încurcă în diacritice sau majuscule", () => {
    expect(guessPeriod("Tabel Decembrie 2025.xlsx")?.date).toBe("2025-12-01");
    expect(guessPeriod("Tabel FEBRUARIE 2026.xlsx")?.date).toBe("2026-02-01");
    expect(guessPeriod("Tabel iănuărie 2026.xlsx")?.date).toBe("2026-01-01");
    expect(guessPeriod("Tabel mărtie 2026.xlsx")?.date).toBe("2026-03-01");
  });

  it("acceptă underscore sau liniuță între lună și an", () => {
    expect(guessPeriod("Tabel_iulie_2026.xlsx")?.date).toBe("2026-07-01");
    expect(guessPeriod("tabel-mai-2026.xlsx")?.date).toBe("2026-05-01");
  });

  it("cere anul lângă lună", () => {
    expect(guessPeriod("Tabel iunie.xlsx")).toBeNull();
    expect(guessPeriod("2026 fără lună.xlsx")).toBeNull();
  });

  it("nu prinde luna ascunsă în alt cuvânt", () => {
    expect(guessPeriod("Domain 2026.xlsx")).toBeNull();
    expect(guessPeriod("Raport premai 2026.xlsx")).toBeNull();
    expect(guessPeriod("Contramartie 2026.xlsx")).toBeNull();
  });

  it("cere anul lipit de lună, nu oriunde în nume", () => {
    expect(guessPeriod("Tabel iunie penitenciare 2026.xlsx")).toBeNull();
  });

  it("preferă data explicită numelui de lună", () => {
    expect(guessPeriod("Tabel ianuarie 15.06.2026.xlsx")?.date).toBe(
      "2026-06-15",
    );
  });
});
