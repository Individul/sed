import { describe, it, expect } from "vitest";
import { isDispatchStep, isResponseStep, templateStepsForTags } from "./subtask-templates";

describe("isDispatchStep", () => {
  it("prinde pașii de expediere din ambele șabloane", () => {
    expect(isDispatchStep("Demers expediat la instanță")).toBe(true);
    expect(isDispatchStep("Solicitare expediată")).toBe(true);
  });
  it("nu prinde pașii de pregătire", () => {
    expect(isDispatchStep("Demers întocmit")).toBe(false);
  });
});

describe("isResponseStep", () => {
  it("prinde pașii prin care răspunsul a sosit", () => {
    expect(isResponseStep("Demers examinat de instanță")).toBe(true);
    expect(isResponseStep("Hotărâre primită")).toBe(true);
  });
  it("nu prinde expedierea — altfel sarcina s-ar închide la trimitere", () => {
    expect(isResponseStep("Demers expediat la instanță")).toBe(false);
    expect(isResponseStep("Solicitare expediată")).toBe(false);
  });
  it("nu prinde pașii de pregătire", () => {
    expect(isResponseStep("Demers întocmit")).toBe(false);
    expect(isResponseStep("Solicitare întocmită")).toBe(false);
  });
  it("tolerează diacriticele și majusculele", () => {
    expect(isResponseStep("HOTĂRÎRE PRIMITĂ")).toBe(true);
  });
});

describe("cele două reguli nu se suprapun", () => {
  it("niciun pas din șabloane nu e și expediere, și răspuns", () => {
    const steps = templateStepsForTags(["cumulare", "solicitare hotariri"]);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(isDispatchStep(step) && isResponseStep(step)).toBe(false);
    }
  });
});

describe("șablonul pentru dispoziție de executare", () => {
  it("are aceiași pași ca solicitarea de hotărâri, cu alt act la final", () => {
    const disp = templateStepsForTags(["Dispozitie de executare"]);
    const hot = templateStepsForTags(["Solicitare hotărîri"]);
    expect(disp.slice(0, 2)).toEqual(hot.slice(0, 2));
    expect(disp[2]).toBe("Dispoziție de executare primită");
  });

  it("se potrivește și scris cu diacritice", () => {
    // Eticheta din bază e „Dispozitie", fără ș — potrivirea nu depinde de asta.
    expect(templateStepsForTags(["Dispoziție de executare"])).toHaveLength(3);
  });

  it("pasul final închide sarcina, expedierea o trece în așteptare", () => {
    const steps = templateStepsForTags(["Dispozitie de executare"]);
    expect(isDispatchStep(steps[1])).toBe(true);
    expect(isResponseStep(steps[2])).toBe(true);
    expect(isResponseStep(steps[1])).toBe(false);
  });

  it("cu ambele etichete, pașii comuni nu se dublează", () => {
    const steps = templateStepsForTags(["Solicitare hotărîri", "Dispozitie de executare"]);
    expect(steps).toEqual([
      "Solicitare întocmită",
      "Solicitare expediată",
      "Hotărâre primită",
      "Dispoziție de executare primită",
    ]);
  });
});
