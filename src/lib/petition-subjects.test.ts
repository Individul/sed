import { describe, it, expect } from "vitest";
import { splitSubject, hasSubjectPreset, toggleSubjectPreset } from "./petition-subjects";

describe("splitSubject", () => {
  it("desface obiectul compus în bucăți", () => {
    expect(splitSubject("Art. 91; Copii acte")).toEqual(["Art. 91", "Copii acte"]);
  });
  it("tolerează „;” fără spațiu și spații în plus", () => {
    expect(splitSubject("  Art. 91 ;Transfer  ")).toEqual(["Art. 91", "Transfer"]);
  });
  it("ignoră bucățile goale", () => {
    expect(splitSubject(";; Transfer ;;")).toEqual(["Transfer"]);
    expect(splitSubject("")).toEqual([]);
  });
});

describe("hasSubjectPreset", () => {
  it("recunoaște o presetare aleasă", () => {
    expect(hasSubjectPreset("Art. 91; Copii acte", "Copii acte")).toBe(true);
  });
  it("nu se lasă păcălit de potriviri parțiale", () => {
    expect(hasSubjectPreset("Art. 91 (Liberare condiționată)", "Art. 91")).toBe(false);
    expect(hasSubjectPreset("Art. 917", "Art. 91")).toBe(false);
  });
  it("compară fără majuscule", () => {
    expect(hasSubjectPreset("art. 91", "Art. 91")).toBe(true);
  });
});

describe("toggleSubjectPreset", () => {
  it("adaugă pe câmp gol", () => {
    expect(toggleSubjectPreset("", "Transfer")).toBe("Transfer");
  });
  it("adaugă la coadă păstrând ce era", () => {
    expect(toggleSubjectPreset("Art. 91", "Copii acte")).toBe("Art. 91; Copii acte");
  });
  it("scoate presetarea deja aleasă", () => {
    expect(toggleSubjectPreset("Art. 91; Copii acte", "Art. 91")).toBe("Copii acte");
  });
  it("golește câmpul când se scoate ultima", () => {
    expect(toggleSubjectPreset("Transfer", "Transfer")).toBe("");
  });
  it("păstrează textul scris de mână", () => {
    expect(toggleSubjectPreset("cerere scrisă olograf; Art. 92", "Art. 92")).toBe(
      "cerere scrisă olograf",
    );
    expect(toggleSubjectPreset("cerere scrisă olograf", "Art. 92")).toBe(
      "cerere scrisă olograf; Art. 92",
    );
  });
  it("normalizează separatorul la rescriere", () => {
    expect(toggleSubjectPreset("Art. 91 ;Transfer", "Audiență")).toBe(
      "Art. 91; Transfer; Audiență",
    );
  });
  it("adăugarea urmată de scoatere readuce forma inițială", () => {
    const start = "Art. 91; Transfer";
    expect(toggleSubjectPreset(toggleSubjectPreset(start, "Audiență"), "Audiență")).toBe(start);
  });
});
