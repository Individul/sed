import { describe, expect, it } from "vitest";
import { autoAssignee, LITERE_ACOPERITE } from "./auto-assignee";
import type { Profile } from "./types";

const p = (id: string, full_name: string): Profile =>
  ({ id, full_name, role: "member" }) as Profile;

const NATALIA = p("n1", "Natalia Spinei");
const ANA = p("a1", "Ana Cojocari");
const DUMITRU = p("d1", "Dumitru Prisăcaru");
const PROFILURI = [DUMITRU, NATALIA, ANA];

describe("cui îi revine petiția", () => {
  it("litera de la începutul numelui decide", () => {
    expect(autoAssignee("Cebotari Alexandr", PROFILURI)).toBe("n1");
    expect(autoAssignee("Ataman Iurie", PROFILURI)).toBe("a1");
  });

  it("diacriticele merg unde merge și litera de bază", () => {
    // „Ș" la Ana, ca „S"; „Î" la Natalia, ca „I"; „Ă"/„Â" la Ana, ca „A".
    expect(autoAssignee("Șoimu Vasile", PROFILURI)).toBe("a1");
    expect(autoAssignee("Țurcanu Ion", PROFILURI)).toBe("a1");
    expect(autoAssignee("Îndrumaru Petru", PROFILURI)).toBe("n1");
    expect(autoAssignee("Ăleanu Mihai", PROFILURI)).toBe("a1");
  });

  it("nu contează cum e scris: majuscule, spații la început", () => {
    expect(autoAssignee("  LIVCUTIN Vitalii", PROFILURI)).toBe("n1");
  });

  it("numele gol nu atribuie nimănui", () => {
    // Se cheamă la fiecare tastă, deci cazul „câmp încă gol" e cel obișnuit.
    expect(autoAssignee("", PROFILURI)).toBeNull();
    expect(autoAssignee("   ", PROFILURI)).toBeNull();
  });

  it("litera neacoperită lasă câmpul gol, nu ghicește", () => {
    expect(autoAssignee("Kravciuc Oleg", PROFILURI)).toBeNull();
    expect(autoAssignee("Xenofontov Ion", PROFILURI)).toBeNull();
  });

  it("dacă persoana din regulă nu e printre profiluri, nu se atribuie", () => {
    // Cazul în care una dintre colege pleacă sau își schimbă numele: regula
    // tace, nu pune pe altcineva.
    expect(autoAssignee("Cebotari Alexandr", [DUMITRU, ANA])).toBeNull();
  });
});

describe("structura regulii", () => {
  it("nicio literă nu e trecută la amândouă", () => {
    // O literă în ambele liste ar face atribuirea să depindă de ordinea din cod.
    const [a, b] = LITERE_ACOPERITE;
    const comune = [...a.litere].filter((l) => b.litere.includes(l));
    expect(comune).toEqual([]);
  });

  it("literele sunt scrise pliat, altfel `fold` nu le-ar găsi niciodată", () => {
    for (const r of LITERE_ACOPERITE) {
      expect(r.litere).toBe(r.litere.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""));
    }
  });
});
