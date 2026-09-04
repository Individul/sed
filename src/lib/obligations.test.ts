import { describe, expect, it } from "vitest";
import {
  bandUrgency,
  lastDue,
  needsAttention,
  nextDue,
  pendingFor,
  sortPending,
  type Obligation,
  type Pending,
} from "./obligations";
import { toISODate } from "./periods";

const o = (over: Partial<Obligation>): Obligation => ({
  id: "1", title: "x", recipient: "ANP", kind: "lunar_zi", day_of_month: 20,
  weekday: null, starts_on: "2020-01-01", assignee_id: null, active: true, position: 0,
  created_at: "", updated_at: "", ...over,
});

const ZI_20 = o({ id: "zpm", day_of_month: 20 });
const ZI_30 = o({ id: "demersuri", day_of_month: 30 });
const ULTIMA = o({ id: "lunara", kind: "lunar_ultima_zi", day_of_month: null });
const VINERI = o({ id: "saptamanala", kind: "saptamanal", day_of_month: null, weekday: 5 });

describe("termenul lunar la zi fixă", () => {
  it("ziua cerută, când există", () => {
    expect(toISODate(nextDue(ZI_20, new Date(2026, 7, 1)))).toBe("2026-08-20");
  });

  it("„data de 30” în februarie cade pe ultima zi, nu în martie", () => {
    // Capcana: `new Date(2026, 1, 30)` alunecă în martie, adică termenul s-ar
    // muta cu două zile mai târziu exact în luna în care e cel mai strâns.
    expect(toISODate(nextDue(ZI_30, new Date(2026, 1, 1)))).toBe("2026-02-28");
  });

  it("în an bisect, februarie are 29", () => {
    expect(toISODate(nextDue(ZI_30, new Date(2028, 1, 1)))).toBe("2028-02-29");
  });

  it("după ce ziua a trecut, urmează luna viitoare", () => {
    expect(toISODate(nextDue(ZI_20, new Date(2026, 7, 21)))).toBe("2026-09-20");
  });

  it("chiar în ziua termenului, el încă n-a trecut", () => {
    expect(toISODate(lastDue(ZI_20, new Date(2026, 7, 20)))).toBe("2026-08-20");
  });
});

describe("termenul în ultima zi a lunii", () => {
  it("nu e „31”: fiecare lună are ultima ei zi", () => {
    expect(toISODate(nextDue(ULTIMA, new Date(2026, 3, 1)))).toBe("2026-04-30");
    expect(toISODate(nextDue(ULTIMA, new Date(2026, 1, 1)))).toBe("2026-02-28");
    expect(toISODate(nextDue(ULTIMA, new Date(2026, 0, 1)))).toBe("2026-01-31");
  });
});

describe("termenul săptămânal", () => {
  it("vinerea din săptămâna curentă", () => {
    // 3 august 2026 e luni.
    expect(toISODate(nextDue(VINERI, new Date(2026, 7, 3)))).toBe("2026-08-07");
  });

  it("sâmbăta, următorul e vinerea viitoare", () => {
    expect(toISODate(nextDue(VINERI, new Date(2026, 7, 8)))).toBe("2026-08-14");
  });

  it("cel mai recent termen trecut, văzut sâmbăta", () => {
    expect(toISODate(lastDue(VINERI, new Date(2026, 7, 8)))).toBe("2026-08-07");
  });
});

describe("pendingFor", () => {
  it("termenul trecut și nebifat rămâne cel care contează", () => {
    // Restanța nu dispare pentru că a venit luna următoare.
    const p = pendingFor(ZI_20, new Set(), new Date(2026, 7, 25));
    expect(p.due).toBe("2026-08-20");
    expect(p.overdue).toBe(true);
    expect(p.days).toBe(-5);
  });

  it("bifat → se trece la termenul următor", () => {
    const p = pendingFor(ZI_20, new Set(["2026-08-20"]), new Date(2026, 7, 25));
    expect(p.due).toBe("2026-09-20");
    expect(p.overdue).toBe(false);
  });

  it("înainte de termen, arată termenul apropiat", () => {
    const p = pendingFor(ZI_20, new Set(["2026-07-20"]), new Date(2026, 7, 17));
    expect(p.due).toBe("2026-08-20");
    expect(p.days).toBe(3);
  });

  it("se privește în urmă o singură apariție", () => {
    // O dare de seamă nebifată acum șase luni nu mai e o acțiune de făcut;
    // ținută la vedere, ar împinge afară termenul de acum.
    const p = pendingFor(ZI_20, new Set(), new Date(2026, 7, 10));
    expect(p.due).toBe("2026-07-20");
  });

  it("bifa pusă din timp se vede: rândul trece la termenul următor", () => {
    // Fluxul normal: raportul cu termen pe 20 se trimite pe 17-19. Bifa cade pe
    // termenul viitor (20 august), iar rândul trebuie să avanseze — altfel bifa
    // e invizibilă, iar un click greșit marchează tăcut un raport netrimis ca
    // trimis, fără nicio schimbare pe ecran.
    const p = pendingFor(ZI_20, new Set(["2026-07-20", "2026-08-20"]), new Date(2026, 7, 18));
    expect(p.due).toBe("2026-09-20");
    expect(p.overdue).toBe(false);
    expect(needsAttention(p)).toBe(false);
  });

  it("merge înainte peste oricâte termene deja bifate", () => {
    const p = pendingFor(
      ZI_20,
      new Set(["2026-07-20", "2026-08-20", "2026-09-20"]),
      new Date(2026, 7, 18),
    );
    expect(p.due).toBe("2026-10-20");
  });

  it("săptămânal: bifa din timp avansează la vinerea următoare", () => {
    // 5 aug 2026 e miercuri; vinerea curentă e 7 aug. Bifată din timp,
    // urmează 14 aug.
    const p = pendingFor(VINERI, new Set(["2026-07-31", "2026-08-07"]), new Date(2026, 7, 5));
    expect(p.due).toBe("2026-08-14");
  });

  it("cu început în viitor, termenul de start bifat avansează, nu se întoarce", () => {
    // Obligația începe în viitor; primul ei termen e 20 august. Bifat din timp,
    // rândul trebuie să arate 20 septembrie — nu tot 20 august înapoi.
    const startViitor = o({ starts_on: "2026-08-01" });
    const p = pendingFor(startViitor, new Set(["2026-08-20"]), new Date(2026, 6, 25));
    expect(p.due).toBe("2026-09-20");
  });

  it("ultima zi a lunii: bifa din timp trece la ultima zi a lunii următoare", () => {
    const p = pendingFor(ULTIMA, new Set(["2026-07-31", "2026-08-31"]), new Date(2026, 7, 28));
    expect(p.due).toBe("2026-09-30");
  });
});

describe("ce se arată la vedere", () => {
  it("restanța se arată întotdeauna", () => {
    expect(needsAttention(pendingFor(ZI_20, new Set(), new Date(2026, 7, 25)))).toBe(true);
  });

  it("lunara tace până la cinci zile înainte", () => {
    expect(needsAttention(pendingFor(ZI_20, new Set(["2026-07-20"]), new Date(2026, 7, 14)))).toBe(
      false,
    );
    expect(needsAttention(pendingFor(ZI_20, new Set(["2026-07-20"]), new Date(2026, 7, 15)))).toBe(
      true,
    );
  });

  it("săptămânala nu stă pe ecran toată săptămâna", () => {
    // Cu preavizul lunar, o obligație de vineri ar fi vizibilă zilnic, iar o
    // bandă permanentă se citește la fel de puțin ca nimic.
    const luni = new Date(2026, 7, 3);
    expect(needsAttention(pendingFor(VINERI, new Set(["2026-07-31"]), luni))).toBe(false);
    const miercuri = new Date(2026, 7, 5);
    expect(needsAttention(pendingFor(VINERI, new Set(["2026-07-31"]), miercuri))).toBe(true);
  });
});

describe("sortPending", () => {
  it("restanțele primele, apoi după termen", () => {
    const azi = new Date(2026, 7, 25);
    const items = [
      // Bifat pe 30 iulie, deci termenul lui e 30 august — încă în viitor.
      pendingFor(ZI_30, new Set(["2026-07-30"]), azi),
      pendingFor(ZI_20, new Set(), azi), // 20 august, restant
    ];
    expect(sortPending(items).map((p) => p.obligation.id)).toEqual(["zpm", "demersuri"]);
  });
});


describe("data de început", () => {
  // Cele patru obligații reale pornesc din august 2026; până atunci evidența
  // nu exista, deci iulie n-are cum să fie restant.
  const DIN_AUGUST = o({ day_of_month: 30, starts_on: "2026-08-01" });
  const LUNI_3_AUG = new Date(2026, 7, 3);

  it("termenul dinaintea începutului nu e restanță", () => {
    // Fără regula asta, pe 3 august ar apărea „restant din 30 iulie".
    const p = pendingFor(DIN_AUGUST, new Set(), LUNI_3_AUG);
    expect(p.due).toBe("2026-08-30");
    expect(p.overdue).toBe(false);
  });

  it("prima apariție de după început e cea căutată", () => {
    const vineri = o({ kind: "saptamanal", day_of_month: null, weekday: 5, starts_on: "2026-08-01" });
    expect(pendingFor(vineri, new Set(), LUNI_3_AUG).due).toBe("2026-08-07");
  });

  it("ultima zi a lunii, cu început la 1 august", () => {
    const ultima = o({ kind: "lunar_ultima_zi", day_of_month: null, starts_on: "2026-08-01" });
    expect(pendingFor(ultima, new Set(), LUNI_3_AUG).due).toBe("2026-08-31");
  });

  it("după ce evidența a pornit, restanțele se văd normal", () => {
    // Regula taie doar înaintea începutului, nu ascunde restanțe reale.
    const p = pendingFor(DIN_AUGUST, new Set(), new Date(2026, 8, 5));
    expect(p.due).toBe("2026-08-30");
    expect(p.overdue).toBe(true);
  });

  it("o obligație înscrisă azi prinde termenul care încă n-a venit", () => {
    const noua = o({ day_of_month: 20, starts_on: "2026-10-15" });
    expect(pendingFor(noua, new Set(), new Date(2026, 9, 15)).due).toBe("2026-10-20");
  });

  it("înscrisă după termenul lunii, sare la luna următoare", () => {
    const tarziu = o({ day_of_month: 20, starts_on: "2026-10-25" });
    expect(pendingFor(tarziu, new Set(), new Date(2026, 9, 25)).due).toBe("2026-11-20");
  });
});

describe("bandUrgency", () => {
  // Treapta benzii se decide doar din `days` și `overdue`; restul câmpurilor
  // sunt umplute ca să avem un `Pending` întreg, nu fiindcă ar conta aici.
  const p = (days: number): Pending => ({
    obligation: ZI_20,
    due: "2026-08-30",
    days,
    overdue: days < 0,
  });

  it("fără nimic scadent azi sau trecut, banda e doar apropiată", () => {
    expect(bandUrgency([p(3), p(5)])).toBe("apropiat");
  });

  it("ziua termenului își are treapta ei, nu se pierde în „apropiate”", () => {
    expect(bandUrgency([p(0)])).toBe("astazi");
  });

  it("un termen de azi ridică banda chiar dacă restul sunt departe", () => {
    expect(bandUrgency([p(4), p(0), p(2)])).toBe("astazi");
  });

  it("restanța bate ziua termenului: aia e știrea", () => {
    expect(bandUrgency([p(0), p(-1)])).toBe("restant");
  });

  it("o zi rămasă nu e încă „astăzi”", () => {
    // Granița contează: la 1 zi mai e timp de lucru, la 0 nu mai e.
    expect(bandUrgency([p(1)])).toBe("apropiat");
  });
});
