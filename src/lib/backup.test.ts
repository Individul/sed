import { describe, expect, it } from "vitest";
import {
  backupStatus,
  dumpPath,
  filePath,
  missingFiles,
  alreadyCovered,
  isStale,
  restoreRefusal,
  type BackupRun,
  type StoredFile,
} from "./backup";

describe("căile din repo", () => {
  it("baza de date primește un fișier pe zi", () => {
    expect(dumpPath(new Date(2026, 6, 31))).toBe("db/2026-07-31.json");
  });

  it("fișierele păstrează bucketul în cale, ca să nu se ciocnească", () => {
    expect(filePath("petitions", "2026/cerere.pdf")).toBe("files/petitions/2026/cerere.pdf");
  });
});

describe("ce lipsește față de manifest", () => {
  const inBucket: StoredFile[] = [
    { bucket: "petitions", name: "a.pdf", size: 10 },
    { bucket: "petitions", name: "b.pdf", size: 20 },
    { bucket: "statistics", name: "c.xlsx", size: 30 },
  ];

  it("le dă pe cele care nu sunt salvate", () => {
    const saved = [{ bucket: "petitions", name: "a.pdf", size: 10 }];
    expect(missingFiles(inBucket, saved).map((f) => f.name)).toEqual(["b.pdf", "c.xlsx"]);
  });

  it("nimic de urcat când manifestul le are pe toate", () => {
    expect(missingFiles(inBucket, inBucket)).toEqual([]);
  });

  it("același nume în buckete diferite sunt fișiere diferite", () => {
    const bucket: StoredFile[] = [
      { bucket: "petitions", name: "x.pdf", size: 1 },
      { bucket: "statistics", name: "x.pdf", size: 1 },
    ];
    const saved = [{ bucket: "petitions", name: "x.pdf", size: 1 }];
    expect(missingFiles(bucket, saved)).toHaveLength(1);
    expect(missingFiles(bucket, saved)[0].bucket).toBe("statistics");
  });

  it("un fișier care și-a schimbat mărimea se urcă din nou", () => {
    // Scanurile nu se schimbă, dar dacă totuși se întâmplă, tăcerea ar fi
    // pierdere de date: manifestul ar spune „salvat" pentru altceva.
    const saved = [{ bucket: "petitions", name: "a.pdf", size: 999 }];
    expect(missingFiles(inBucket, saved).map((f) => f.name)).toContain("a.pdf");
  });
});

describe("ce refuză restaurarea automată", () => {
  it("refuză formatul complet și trimite la README", () => {
    // Butonul știe patru tabele din cincisprezece. Un import pe jumătate,
    // raportat ca reușită, e mai rău decât un refuz limpede.
    const refuz = restoreRefusal({ app: "task-manager", version: 2, data: {} });
    expect(refuz).toContain("README");
    expect(refuz).toContain("2");
  });

  it("acceptă formatul vechi", () => {
    expect(restoreRefusal({ app: "task-manager", version: 1, data: { tasks: [] } })).toBeNull();
  });

  it("un fișier fără versiune merge mai departe, la validarea de conținut", () => {
    // Nu e treaba refuzului să spună dacă fișierul e bun — doar dacă e prea
    // nou. Restul verificărilor sunt în acțiune, ca înainte.
    expect(restoreRefusal({ data: { tasks: [] } })).toBeNull();
    expect(restoreRefusal(null)).toBeNull();
    expect(restoreRefusal("nu-i un obiect")).toBeNull();
  });

  it("prinde versiunea scrisă ca text", () => {
    // JSON-ul vine dintr-un fișier ales de om; „2" în loc de 2 nu trebuie să
    // deschidă ușa pe care cifra o închide.
    expect(restoreRefusal({ version: "2" })).toContain("README");
  });

  it("refuză și un format viitor, nu doar 2", () => {
    // Regula e „mai nou decât știu să import", nu o listă de versiuni.
    expect(restoreRefusal({ version: 3 })).toContain("3");
  });
});

// Marcajele de timp sunt la prânz, nu la 02:00: un instant UTC aproape de
// miezul nopții cade pe altă zi calendaristică locală în funcție de fusul
// mașinii, iar testul ar trece aici și ar pica la altcineva. La prânz rămâne
// aceeași zi pe tot intervalul în care rulează aplicația (UTC pe Vercel).
describe("vechimea copiei", () => {
  const azi = new Date(2026, 6, 31);

  it("o reușită de ieri e în regulă", () => {
    expect(isStale("2026-07-30T12:00:00Z", azi)).toBe(false);
  });

  it("trei zile încă trec", () => {
    expect(isStale("2026-07-28T12:00:00Z", azi)).toBe(false);
  });

  it("a patra zi e prea mult", () => {
    expect(isStale("2026-07-27T12:00:00Z", azi)).toBe(true);
  });

  it("nicio reușită vreodată înseamnă învechit", () => {
    // Nu „în regulă până la proba contrarie": un backup care n-a rulat
    // niciodată e exact cazul în care trebuie să afli.
    expect(isStale(null, azi)).toBe(true);
  });

  it("un timestamp ilizibil e tot învechit", () => {
    // „Nu se poate citi" și „n-a rulat niciodată" primesc același răspuns,
    // fiindcă sunt aceeași situație: lipsește dovada că o copie a reușit.
    // Fără gardă, data invalidă dă NaN, iar `NaN > maxDays` e false — deci o
    // valoare stricată ar raporta „în regulă", exact minciuna de evitat.
    expect(isStale("nu-i o dată", azi)).toBe(true);
  });
});

/**
 * Marcajele sunt la prânz din același motiv ca mai sus: `differenceInCalendarDays`
 * numără zile locale, iar un instant lângă miezul nopții ar cădea pe zile diferite
 * după fusul mașinii care rulează testul.
 */
describe("starea copiei, pentru pagina de administrare", () => {
  const acum = new Date("2026-07-31T12:00:00Z");

  /** O rulare reușită de azi; testele schimbă doar ce le interesează. */
  function run(over: Partial<BackupRun> = {}): BackupRun {
    return {
      started_at: "2026-07-31T12:00:00Z",
      finished_at: "2026-07-31T12:00:40Z",
      ok: true,
      files_uploaded: 15,
      files_pending: 0,
      error: null,
      ...over,
    };
  }

  const reusitaDe = (zi: string, over: Partial<BackupRun> = {}) =>
    run({ started_at: `${zi}T12:00:00Z`, finished_at: `${zi}T12:00:40Z`, ...over });

  const esecDe = (zi: string, over: Partial<BackupRun> = {}) =>
    run({
      ok: false,
      started_at: `${zi}T12:00:00Z`,
      finished_at: `${zi}T12:00:05Z`,
      files_uploaded: 0,
      error: "GitHub a răspuns 401.",
      ...over,
    });

  it("niciun rând înseamnă că n-a rulat niciodată, și asta se vede", () => {
    // Starea de dinainte de prima rulare — cea de azi, cât timp programarea nu
    // există încă. Nu e „în regulă până la proba contrarie": atunci fișierele
    // chiar n-au nicio copie.
    const s = backupStatus({ last: null, lastSuccess: null }, acum);
    expect(s.kind).toBe("niciodata");
    expect(s.level).toBe("warn");
    expect(s.lastSuccessAt).toBeNull();
    expect(s.daysSince).toBeNull();
    expect(s.filesPending).toBe(0);
    expect(s.hint).toContain("Cron Jobs");
  });

  it("rulări fără nicio reușită trimit la jurnalul rulării", () => {
    const s = backupStatus({ last: esecDe("2026-07-31"), lastSuccess: null }, acum);
    expect(s.kind).toBe("nicio-reusita");
    expect(s.level).toBe("warn");
    expect(s.error).toBe("GitHub a răspuns 401.");
    expect(s.hint).toContain("/api/backup");
  });

  it("o copie de azi-noapte nu scoate nicio bandă", () => {
    const azi = run();
    const s = backupStatus({ last: azi, lastSuccess: azi }, acum);
    expect(s.kind).toBe("in-regula");
    expect(s.level).toBe("ok");
    expect(s.hint).toBe("");
    expect(s.error).toBeNull();
  });

  // Capcana 3: „când a reușit ultima copie" și „a căzut ultima încercare" sunt
  // două întrebări, iar răspunsurile lor trimit în locuri diferite.
  describe("învechit: unde anume s-a rupt", () => {
    it("ultima rulare a reușit, dar e veche — nu rularea cade, programarea nu pornește", () => {
      const vechi = reusitaDe("2026-07-26");
      const s = backupStatus({ last: vechi, lastSuccess: vechi }, acum);
      expect(s.kind).toBe("oprit");
      expect(s.level).toBe("warn");
      expect(s.daysSince).toBe(5);
      expect(s.hint).toContain("Cron Jobs");
    });

    it("ultima rulare a eșuat — programarea pornește, rularea cade", () => {
      const s = backupStatus(
        { last: esecDe("2026-07-31"), lastSuccess: reusitaDe("2026-07-26") },
        acum,
      );
      expect(s.kind).toBe("esuat");
      expect(s.level).toBe("warn");
      expect(s.hint).toContain("/api/backup");
    });

    it("cele două stări nu trimit omul în același loc", () => {
      // Un diagnostic greșit e mai rău decât niciunul: cine caută în programare
      // o rulare care cade, sau invers, pierde ziua în care conta.
      const oprit = backupStatus(
        { last: reusitaDe("2026-07-26"), lastSuccess: reusitaDe("2026-07-26") },
        acum,
      );
      const esuat = backupStatus(
        { last: esecDe("2026-07-31"), lastSuccess: reusitaDe("2026-07-26") },
        acum,
      );
      expect(oprit.hint).not.toBe(esuat.hint);
    });
  });

  it("un eșec proaspăt peste o copie recentă se vede, dar fără galben", () => {
    // Încă ești acoperit — copia de ieri e acolo. Banda galbenă aici ar striga
    // degeaba, iar o bandă care strigă degeaba nu se mai citește când trebuie.
    const s = backupStatus(
      { last: esecDe("2026-07-31"), lastSuccess: reusitaDe("2026-07-30") },
      acum,
    );
    expect(s.kind).toBe("esuare-recenta");
    expect(s.level).toBe("info");
    expect(s.lastSuccessAt).toBe("2026-07-30T12:00:40Z");
    expect(s.error).toBe("GitHub a răspuns 401.");
  });

  // Capcana 1: ruta scrie `files_pending` **după** etapa fișierelor, deci o
  // rulare căzută înainte de ea îl lasă 0.
  it("restanța se citește de la ultima reușită, nu de la ultima rulare", () => {
    const s = backupStatus(
      {
        last: esecDe("2026-07-31", { files_pending: 0 }),
        lastSuccess: reusitaDe("2026-07-30", { files_pending: 42 }),
      },
      acum,
    );
    // 0 luat din rândul eșuat ar fi fost un „nu mai e nimic de copiat"
    // liniștitor, pentru o rulare care n-a ajuns niciodată la fișiere.
    expect(s.filesPending).toBe(42);
  });

  describe("rulări neîncheiate", () => {
    it("una pornită acum un minut lucrează, nu a eșuat", () => {
      // Alarma falsă e greșeala scumpă: cine tocmai a pornit copia manual se
      // uită la pagină exact în minutul ăsta.
      const s = backupStatus(
        {
          last: run({ ok: false, finished_at: null, started_at: "2026-07-31T11:59:00Z" }),
          lastSuccess: reusitaDe("2026-07-30"),
        },
        acum,
      );
      expect(s.kind).toBe("in-curs");
      expect(s.level).toBe("ok");
      expect(s.error).toBeNull();
    });

    it("una rămasă deschisă de ore e o funcție omorâtă la mijloc, deci un eșec", () => {
      const s = backupStatus(
        {
          last: run({ ok: false, finished_at: null, started_at: "2026-07-31T02:00:00Z" }),
          lastSuccess: reusitaDe("2026-07-30"),
        },
        acum,
      );
      expect(s.kind).toBe("esuare-recenta");
      // Niciun motiv scris: funcția n-a apucat să-l scrie. Panoul spune ce să
      // verifice oricum, fără să se sprijine pe un text care lipsește.
      expect(s.error).toBeNull();
    });

    it("o rulare în curs peste o copie învechită rămâne galbenă", () => {
      // Rularea de acum poate reuși, dar până se încheie tot neacoperit ești.
      const s = backupStatus(
        {
          last: run({ ok: false, finished_at: null, started_at: "2026-07-31T11:59:00Z" }),
          lastSuccess: reusitaDe("2026-07-20"),
        },
        acum,
      );
      expect(s.kind).toBe("in-curs");
      expect(s.level).toBe("warn");
    });
  });

  describe("motivul erorii, care vine dintr-un răspuns HTTP străin", () => {
    it("se taie, ca să nu umple pagina", () => {
      const s = backupStatus(
        { last: esecDe("2026-07-31", { error: "x".repeat(5000) }), lastSuccess: null },
        acum,
      );
      expect(s.error).toHaveLength(241);
      expect(s.error?.endsWith("…")).toBe(true);
    });

    it("se strânge pe un rând, ca să nu crească banda pe verticală", () => {
      // O pagină de eroare întreagă are zeci de rânduri; nefiltrată, ar împinge
      // restul paginii în jos exact când trebuie citită.
      const s = backupStatus(
        {
          last: esecDe("2026-07-31", { error: "<html>\n  <body>\n    502\n  </body>\n</html>" }),
          lastSuccess: null,
        },
        acum,
      );
      expect(s.error).toBe("<html> <body> 502 </body> </html>");
    });

    it("un motiv gol nu devine un rând gol în pagină", () => {
      const s = backupStatus(
        { last: esecDe("2026-07-31", { error: "   \n  " }), lastSuccess: null },
        acum,
      );
      expect(s.error).toBeNull();
    });
  });

  it("o dată ilizibilă nu ajunge în pagină și nu trece drept reușită", () => {
    // Formatarea unei date invalide ar arunca, iar adminul ar rămâne fără
    // pagină. Lipsa dovezii se citește ca lipsă, ca în `isStale`.
    const stricat = run({ started_at: "nu-i o dată", finished_at: "nici asta" });
    const s = backupStatus({ last: stricat, lastSuccess: stricat }, acum);
    expect(s.lastSuccessAt).toBeNull();
    expect(s.daysSince).toBeNull();
    expect(s.level).toBe("warn");
  });
});

describe("alreadyCovered", () => {
  const noaptea = new Date("2026-08-03T02:00:00Z");

  it("copia primei rulări din aceeași zi acoperă și a doua", () => {
    expect(alreadyCovered("2026-08-03T02:00:12Z", noaptea)).toBe(true);
  });

  it("o reușită de ieri nu acoperă noaptea asta", () => {
    expect(alreadyCovered("2026-08-02T02:00:12Z", noaptea)).toBe(false);
  });

  it("fără nicio reușită, a doua rulare lucrează", () => {
    expect(alreadyCovered(null, noaptea)).toBe(false);
  });

  it("dată ilizibilă → se face copia, nu se sare peste ea", () => {
    // Invers față de `isStale`: acolo necunoscutul dă alarmă, aici lasă copia
    // să ruleze. Ambele greșesc în direcția în care datele rămân salvate.
    expect(alreadyCovered("nu-i o dată", noaptea)).toBe(false);
  });

  it("ora nu contează, doar ziua", () => {
    // Ore din mijlocul zilei, nu de la miezul nopții: „ziua" e cea a serverului
    // (UTC în producție), iar un test legat de fusul mașinii care-l rulează ar
    // trece aici și ar cădea aiurea în altă parte.
    expect(alreadyCovered("2026-08-03T09:00:00Z", new Date("2026-08-03T15:00:00Z"))).toBe(true);
  });
});
