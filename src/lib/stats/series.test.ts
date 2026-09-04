import { describe, it, expect } from "vitest";
import { hasMeaningfulValue, hasBothSeries } from "./series";

describe("hasMeaningfulValue", () => {
  it("ascunde indicatorii care sunt 0 în toate perioadele", () => {
    expect(hasMeaningfulValue([0, 0, 0])).toBe(false);
  });

  it("ascunde și când zerourile sunt amestecate cu perioade lipsă", () => {
    expect(hasMeaningfulValue([0, null, 0])).toBe(false);
  });

  it("păstrează indicatorul dacă a avut măcar o dată o valoare", () => {
    expect(hasMeaningfulValue([0, 3, 0])).toBe(true);
  });

  it("păstrează valorile negative (ex. suprapopularea = -5)", () => {
    expect(hasMeaningfulValue([-5])).toBe(true);
    expect(hasMeaningfulValue([0, -5, 0])).toBe(true);
  });

  it("ascunde indicatorii fără nicio valoare", () => {
    expect(hasMeaningfulValue([])).toBe(false);
    expect(hasMeaningfulValue([null, null])).toBe(false);
  });
});

describe("hasBothSeries", () => {
  it("adevărat doar când există și cumulat, și perioadă", () => {
    expect(
      hasBothSeries([{ series: "cumulat" }, { series: "perioada" }]),
    ).toBe(true);
  });

  it("fals când toate rândurile sunt din aceeași serie", () => {
    expect(hasBothSeries([{ series: "cumulat" }, { series: "cumulat" }])).toBe(false);
    expect(hasBothSeries([{ series: "perioada" }])).toBe(false);
  });

  it("fals pentru listă goală", () => {
    expect(hasBothSeries([])).toBe(false);
  });
});
