import { describe, it, expect } from "vitest";
import { CHANGELOG, isNewSince } from "./changelog";

describe("isNewSince", () => {
  it("intrare mai nouă decât ultima vizită → nouă", () => {
    expect(isNewSince("2026-07-29", "2026-07-28")).toBe(true);
  });
  it("intrare din ziua ultimei vizite → nu mai e nouă", () => {
    expect(isNewSince("2026-07-28", "2026-07-28")).toBe(false);
  });
  it("intrare mai veche → nu e nouă", () => {
    expect(isNewSince("2026-07-27", "2026-07-28")).toBe(false);
  });
  it("prima vizită nu marchează nimic", () => {
    expect(isNewSince("2026-07-29", null)).toBe(false);
  });
});

describe("CHANGELOG", () => {
  it("e ordonat descrescător după dată", () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
  it("toate datele sunt ISO", () => {
    for (const e of CHANGELOG) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("niciun text gol", () => {
    for (const e of CHANGELOG) expect(e.text.trim().length).toBeGreaterThan(0);
  });
});
