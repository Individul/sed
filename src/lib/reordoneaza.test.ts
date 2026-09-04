import { describe, expect, it } from "vitest";
import { reordoneaza } from "./reordoneaza";

const l = ["a", "b", "c", "d", "e"];

describe("reordonarea unei liste", () => {
  it("mută în jos: elementul ajunge exact pe locul cerut", () => {
    // „a" tras peste „c" trebuie să stea pe locul lui „c", adică al treilea.
    expect(reordoneaza(l, 0, 2)).toEqual(["b", "c", "a", "d", "e"]);
  });

  it("mută în sus", () => {
    expect(reordoneaza(l, 4, 1)).toEqual(["a", "e", "b", "c", "d"]);
  });

  it("ultimul tras peste primul ajunge primul", () => {
    // Nu un schimb între ei: „a" coboară cu unu, nu ajunge ultimul.
    expect(reordoneaza(l, 4, 0)).toEqual(["e", "a", "b", "c", "d"]);
  });

  it("vecinii se schimbă între ei", () => {
    expect(reordoneaza(l, 1, 2)).toEqual(["a", "c", "b", "d", "e"]);
    expect(reordoneaza(l, 2, 1)).toEqual(["a", "c", "b", "d", "e"]);
  });

  it("pe locul lui nu se schimbă nimic", () => {
    expect(reordoneaza(l, 2, 2)).toEqual(l);
  });

  it("indicii din afara listei lasă lista neatinsă", () => {
    // O tragere se poate încheia oriunde; nimic nu garantează un index bun.
    expect(reordoneaza(l, -1, 2)).toEqual(l);
    expect(reordoneaza(l, 0, 9)).toEqual(l);
    expect(reordoneaza([], 0, 0)).toEqual([]);
  });

  it("lista dată nu se modifică", () => {
    // Starea din React se înlocuiește, nu se rescrie pe loc.
    const original = [...l];
    reordoneaza(l, 0, 3);
    expect(l).toEqual(original);
  });

  it("oricâte mutări, elementele rămân aceleași", () => {
    let curent = [...l];
    for (const [de, la] of [[0, 4], [3, 1], [2, 2], [4, 0], [1, 3]]) {
      curent = reordoneaza(curent, de, la);
    }
    expect([...curent].sort()).toEqual([...l].sort());
    expect(curent).toHaveLength(l.length);
  });
});
