import { describe, expect, it } from "vitest";
import { contentsUrl, parseRepo, putBody, redact } from "./github";

// Doar logica pură. Cererile către GitHub nu se imită aici: un test care verifică
// că apelăm o machetă scrisă tot de noi n-ar spune nimic despre ce acceptă API-ul
// adevărat. Partea aceea se vede la prima rulare reală.

describe("citirea variabilei GITHUB_BACKUP_REPO", () => {
  it("desparte proprietarul de nume", () => {
    expect(parseRepo("ion/backup-sarcini")).toEqual({ owner: "ion", name: "backup-sarcini" });
  });

  it("nu se împiedică de spațiile din jur", () => {
    // Valoarea e lipită de mână în Vercel; un spațiu la capăt e ușor de făcut.
    expect(parseRepo("  ion/backup-sarcini \n")).toEqual({
      owner: "ion",
      name: "backup-sarcini",
    });
  });

  it("lipsa variabilei dă un mesaj, nu o excepție", () => {
    const rezultat = parseRepo(undefined);
    expect(typeof rezultat).toBe("string");
    expect(rezultat).toContain("GITHUB_BACKUP_REPO");
  });

  it("variabila goală e tot lipsă", () => {
    expect(typeof parseRepo("   ")).toBe("string");
  });

  it("un link întreg e respins", () => {
    // Forma pe care o copiază oricine din bara de adrese. Lăsată să treacă, ar
    // ajunge la GitHub ca un 404 — adică aceeași eroare ca un token fără
    // drepturi, și utilizatorul ar căuta problema în locul greșit.
    expect(typeof parseRepo("https://github.com/ion/backup-sarcini")).toBe("string");
  });

  it("doar numele repo-ului e respins", () => {
    expect(typeof parseRepo("backup-sarcini")).toBe("string");
  });

  it("o jumătate lipsă e respinsă", () => {
    expect(typeof parseRepo("ion/")).toBe("string");
    expect(typeof parseRepo("/backup-sarcini")).toBe("string");
  });
});

describe("adresa fișierului în Contents API", () => {
  const repo = { owner: "ion", name: "backup-sarcini" };

  it("pune calea după /contents/", () => {
    expect(contentsUrl(repo, "db/2026-07-31.json")).toBe(
      "https://api.github.com/repos/ion/backup-sarcini/contents/db/2026-07-31.json",
    );
  });

  it("bara oblică rămâne despărțitor de directoare", () => {
    // Codificat, ar deveni un singur nume de fișier cu „%2F" în el.
    expect(contentsUrl(repo, "files/petitions/2026/cerere.pdf")).toContain(
      "/contents/files/petitions/2026/cerere.pdf",
    );
  });

  it("spațiile și diacriticele din numele scanului se codifică", () => {
    // Numele scanurilor vin de la oameni: „Cerere Ionuț nr. 12.pdf" e obișnuit,
    // iar netrimis codificat ar strica cererea sau ar nimeri altă cale.
    const url = contentsUrl(repo, "files/petitions/Cerere Ionuț.pdf");
    expect(url).toContain("Cerere%20Ionu%C8%9B.pdf");
    expect(url).not.toContain(" ");
  });

  it("semnul întrebării nu taie calea într-un query string", () => {
    expect(contentsUrl(repo, "files/petitions/ce?.pdf")).toContain("ce%3F.pdf");
  });
});

describe("corpul cererii de scriere", () => {
  const continut = Buffer.from("salut");

  it("fără sha, pentru fișier nou, cheia lipsește de tot", () => {
    // `sha: null` nu e totuna cu absența ei: API-ul respinge valoarea nulă în
    // loc să creeze fișierul.
    const body = putBody("copie", continut, null);
    expect("sha" in body).toBe(false);
  });

  it("cu sha, pentru suprascriere", () => {
    expect(putBody("copie", continut, "abc123").sha).toBe("abc123");
  });

  it("conținutul pleacă în base64", () => {
    expect(putBody("copie", continut, null).content).toBe("c2FsdXQ=");
  });
});

describe("ascunderea tokenului din texte", () => {
  // Garanția pe care se sprijină tot modulul: mesajele lui ajung în
  // `backup_runs.error`, de unde panoul de pe `/admin` le pune pe ecran, iar
  // răspunsul rutei de cron le duce în jurnalul din Vercel. Un token scăpat
  // într-un mesaj ar ajunge deodată afișat în pagină și scris în jurnale.
  it("scoate tokenul din mesaj", () => {
    expect(redact("a picat cu ghp_secret123", "ghp_secret123")).toBe(
      "a picat cu [token ascuns]",
    );
  });

  it("scoate toate aparițiile, nu doar prima", () => {
    expect(redact("ghp_x și iar ghp_x", "ghp_x")).not.toContain("ghp_x");
  });

  it("lasă textul neatins când nu conține tokenul", () => {
    expect(redact("404 la scriere", "ghp_secret123")).toBe("404 la scriere");
  });

  it("un token gol nu ciopârțește mesajul", () => {
    // Fără garda asta, căutarea unui șir gol ar tăia textul între toate literele.
    expect(redact("404 la scriere", "")).toBe("404 la scriere");
  });
});
