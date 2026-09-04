import { describe, it, expect } from "vitest";
import {
  MAX_ATTACHMENT_BYTES,
  validateAttachment,
  formatBytes,
  storageKey,
  attachmentDisplayName,
} from "./attachments";

const f = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: "scan.pdf",
  type: "application/pdf",
  size: 1024,
  ...over,
});

describe("validateAttachment", () => {
  it("acceptă PDF, JPG și PNG", () => {
    expect(validateAttachment(f())).toBeNull();
    expect(validateAttachment(f({ name: "a.jpg", type: "image/jpeg" }))).toBeNull();
    expect(validateAttachment(f({ name: "a.png", type: "image/png" }))).toBeNull();
  });

  it("respinge alte tipuri", () => {
    const err = validateAttachment(f({ name: "a.docx", type: "application/msword" }));
    expect(err).toMatch(/PDF/i);
  });

  it("respinge fișierele peste limită", () => {
    const err = validateAttachment(f({ size: MAX_ATTACHMENT_BYTES + 1 }));
    expect(err).toMatch(/10 MB/);
  });

  it("acceptă exact limita", () => {
    expect(validateAttachment(f({ size: MAX_ATTACHMENT_BYTES }))).toBeNull();
  });

  it("respinge fișierul gol", () => {
    expect(validateAttachment(f({ size: 0 }))).toMatch(/gol/i);
  });
});

describe("formatBytes", () => {
  it("formatează lizibil", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1024 * 1024 * 3)).toBe("3 MB");
  });
  it("rotunjește la o zecimală", () => {
    expect(formatBytes(1536)).toBe("1,5 KB");
  });
});

describe("storageKey", () => {
  it("pune fișierul în folderul petiției și păstrează extensia", () => {
    const key = storageKey("11111111-1111-1111-1111-111111111111", "Scan Petiție (1).pdf");
    expect(key.startsWith("11111111-1111-1111-1111-111111111111/")).toBe(true);
    expect(key.endsWith(".pdf")).toBe(true);
  });
  it("curăță diacriticele și spațiile din nume", () => {
    const key = storageKey("abc", "Petiție răspuns.PDF");
    expect(key).toMatch(/^abc\/[a-z0-9-]+-petitie-raspuns\.pdf$/);
  });
});

describe("attachmentDisplayName", () => {
  it("combină numărul petiției cu petiționarul", () => {
    expect(attachmentDisplayName("M-535/26", "Ion Popescu", "scan.pdf")).toBe(
      "M-535-26-Ion-Popescu.pdf",
    );
  });

  it("înlocuiește bara din număr și spațiile din nume", () => {
    expect(attachmentDisplayName("A/1/26", "Ana Maria Pop", "x.JPG")).toBe(
      "A-1-26-Ana-Maria-Pop.jpg",
    );
  });

  it("curăță diacriticele", () => {
    expect(attachmentDisplayName("M-1/26", "Crîlov Pavel", "a.png")).toBe(
      "M-1-26-Crilov-Pavel.png",
    );
  });

  it("adaugă indice pentru fișierele următoare", () => {
    expect(attachmentDisplayName("M-1/26", "Ion Pop", "a.pdf", 2)).toBe("M-1-26-Ion-Pop-2.pdf");
    expect(attachmentDisplayName("M-1/26", "Ion Pop", "a.pdf", 1)).toBe("M-1-26-Ion-Pop.pdf");
  });

  it("se descurcă fără extensie și cu petiționar gol", () => {
    expect(attachmentDisplayName("M-1/26", "", "fisier")).toBe("M-1-26.bin");
  });
});
