import { describe, it, expect } from "vitest";
import { cellText, findCell, findRowStarting, composeLabel, toNumber } from "./grid";

const grid = [
  ["Titlu", null, null],
  [null, "P-5", "P-6"],
  ["Plafon", 100, 753],
  ["Penitenciarul nr. 6", 5, null],
  ["6 Soroca", 107, null],
];

describe("cellText", () => {
  it("normalizează spațiile și tratează null", () => {
    expect(cellText("  a  b ")).toBe("a b");
    expect(cellText(null)).toBe("");
    expect(cellText(7)).toBe("7");
  });
});

describe("findCell", () => {
  it("găsește celula după text exact", () => {
    expect(findCell(grid, (t) => t === "P-6")).toEqual({ row: 1, col: 2 });
  });
  it("întoarce null când nu găsește", () => {
    expect(findCell(grid, (t) => t === "P-99")).toBeNull();
  });
});

describe("findRowStarting", () => {
  it("găsește rândul după prefixul primei celule nevide", () => {
    expect(findRowStarting(grid, "Penitenciarul nr. 6")).toBe(3);
    expect(findRowStarting(grid, "6 ")).toBe(4);
    expect(findRowStarting(grid, "Penitenciarul nr. 9")).toBeNull();
  });
});

describe("composeLabel", () => {
  it("unește etichetele nevide cu ' / '", () => {
    expect(composeLabel(["Art. 12", "", "lit. a)"])).toBe("Art. 12 / lit. a)");
    expect(composeLabel(["", ""])).toBe("");
  });
});

describe("toNumber", () => {
  it("acceptă numere și șiruri numerice", () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber("12")).toBe(12);
    expect(toNumber(" 3,5 ")).toBe(3.5);
  });
  it("întoarce null pentru gol sau text", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber("abc")).toBeNull();
  });
});
