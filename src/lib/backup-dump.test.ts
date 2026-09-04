import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, DUMP_VERSION } from "./backup-dump";

const MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "supabase",
  "migrations",
);

/**
 * `create table [if not exists] [schema.]nume`.
 *
 * Schema se prinde într-un grup separat ca să poată fi sărită: un tabel scris
 * vreodată în alt schema (Storage și auth le au pe ale lor) nu e dată a
 * aplicației și n-are ce căuta în copie.
 */
const CREATE_TABLE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)/gi;

/**
 * Singurul tabel din migrări care **nu** intră în dump: `backup_runs` e
 * evidența copierii, nu date ale instituției — la o restaurare, istoricul
 * rulărilor n-are ce să-ți spună.
 *
 * Scris aici anume, nu lăsat să lipsească pe tăcute: o excepție nescrisă nu se
 * deosebește de un tabel uitat, adică exact bugul pe care testul îl păzește.
 */
const IN_AFARA_COPIEI = ["backup_runs"];

/** Tabelele declarate în migrări, sursa adevărului despre ce există în bază. */
function tabeleDinMigrari(): string[] {
  const nume = new Set<string>();

  for (const fisier of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(MIGRATIONS, fisier), "utf8");
    for (const [, schema, tabel] of sql.matchAll(CREATE_TABLE)) {
      if (schema && schema.toLowerCase() !== "public") continue;
      nume.add(tabel.toLowerCase());
    }
  }

  return [...nume];
}

/**
 * Lista tabelelor e singurul loc din care se citește ce intră în copie. Bugul
 * care a dus la ea a fost tocmai o listă uitată: butonul de descărcare salva
 * cinci tabele din cincisprezece, fiindcă lista lui era o copie pe care nimeni
 * n-a mai actualizat-o. Testele de aici păzesc lista rămasă.
 */
describe("lista tabelelor din copie", () => {
  const names = BACKUP_TABLES.map((t) => t.name);

  it("nu repetă niciun tabel", () => {
    expect(new Set(names).size).toBe(names.length);
  });

  it("le are pe toate cele din migrări, fără nicio excepție netrecută în scris", () => {
    // Lista așteptată se citește din migrări, nu se scrie aici. Un număr scris
    // de mână — „să fie cincisprezece" — nu păzește nimic: cine adaugă al
    // șaisprezecelea tabel și uită `BACKUP_TABLES` uită și numărul, testele
    // rămân verzi, iar dumpul raportează liniștit „ok" peste un modul întreg
    // lipsă. Migrările sunt singurul loc care nu poate rămâne în urmă față de
    // baza de date: dacă tabelul există, el a trecut pe acolo.
    const dinMigrari = tabeleDinMigrari();

    // Parserul se verifică pe ceva ce știm sigur că e acolo. Fără asta, o cale
    // greșită sau un regex stricat ar face testul să compare două liste goale
    // și să treacă — adică tocmai garda care lipsea.
    expect(dinMigrari, "migrările nu s-au citit: parserul sau calea sunt stricate").toContain(
      "backup_runs",
    );

    const asteptate = dinMigrari.filter((t) => !IN_AFARA_COPIEI.includes(t));
    const lipsa = asteptate.filter((t) => !names.includes(t));
    const inPlus = names.filter((t) => !asteptate.includes(t));

    expect(lipsa, `tabele care există în bază dar nu intră în copie: ${lipsa.join(", ")}`).toEqual(
      [],
    );
    expect(
      inPlus,
      `tabele din BACKUP_TABLES care nu există în nicio migrare: ${inPlus.join(", ")}`,
    ).toEqual([]);
  });

  it("scrie formatul complet, nu pe cel vechi", () => {
    // Versiunea 1 era fișierul cu cinci tabele. Cine dă peste un fișier peste
    // ani deosebește copia întreagă de cea parțială doar după numărul ăsta.
    expect(DUMP_VERSION).toBe(2);
  });

  it("fiecare tabel se termină cu o coloană unică", () => {
    // Fără o ordine totală, paginarea peste rânduri egale poate sări rânduri
    // sau le poate lua de două ori — pierderea tăcută pe care copia există
    // s-o prevină. `created_at` singur nu ajunge: două rânduri scrise în
    // aceeași tranzacție îl au identic.
    for (const table of BACKUP_TABLES) {
      if (table.name === "task_tags") {
        // Singurul tabel fără `id`: cheia primară e perechea.
        expect(table.order).toEqual(["task_id", "tag_id"]);
        continue;
      }
      const last = table.order[table.order.length - 1];
      expect(last, `„${table.name}" nu se termină cu o coloană unică`).toBe("id");
    }
  });

  it("părintele vine înaintea copilului, pentru restaurare", () => {
    // Perechile sunt citite din migrări (0001, 0008, 0010, 0012, 0013, 0015,
    // 0016), nu din lista testată — altfel testul ar confirma doar că lista e
    // egală cu ea însăși. La restaurare fișierul se parcurge de sus în jos,
    // deci un copil pus prea sus ar cere rânduri care încă nu există.
    const foreignKeys: ReadonlyArray<readonly [string, string]> = [
      ["tasks", "profiles"],
      ["subtasks", "tasks"],
      ["comments", "tasks"],
      ["comments", "profiles"],
      ["task_tags", "tasks"],
      ["task_tags", "tags"],
      ["petitions", "profiles"],
      ["petition_attachments", "petitions"],
      ["petition_attachments", "profiles"],
      ["hearings", "profiles"],
      ["transfers", "profiles"],
      ["transfer_plans", "profiles"],
      ["stat_reports", "profiles"],
      ["stat_values", "stat_reports"],
      ["notifications", "profiles"],
      ["notifications", "tasks"],
      ["notifications", "petitions"],
    ];

    for (const [child, parent] of foreignKeys) {
      const childAt = names.indexOf(child);
      const parentAt = names.indexOf(parent);
      expect(childAt, `„${child}" lipsește din copie`).toBeGreaterThanOrEqual(0);
      expect(parentAt, `„${parent}" lipsește din copie`).toBeGreaterThanOrEqual(0);
      expect(childAt, `„${child}" trebuie să vină după „${parent}"`).toBeGreaterThan(parentAt);
    }
  });

  it("modulele apărute după butonul vechi sunt în listă", () => {
    // Bugul reparat: petițiile, ședințele, transferurile și statisticile
    // existau de un an în aplicație și lipseau din backup.
    expect(names).toEqual(
      expect.arrayContaining([
        "petitions",
        "petition_attachments",
        "hearings",
        "transfers",
        "transfer_plans",
        "stat_reports",
        "stat_values",
        "subtasks",
        "notifications",
        "audit_log",
      ]),
    );
  });
});
