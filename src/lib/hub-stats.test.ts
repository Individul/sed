import { describe, it, expect } from "vitest";
import {
  taskStats,
  petitionStats,
  countsByAssignee,
  groupByAssignee,
  isTaskOverdue,
  isPetitionOverdue,
} from "./hub-stats";
import type { Task, Petition, Profile } from "./types";

const prof = (id: string, name: string | null): Profile => ({
  id, full_name: name, username: null, avatar_url: null, role: "member",
});

const t = (over: Partial<Task>): Task => ({
  id: "1", title: "x", description: null, status: "todo", priority: "medium",
  due_date: null, waiting_since: null,
  assignee_id: null, created_by: "u", created_at: "", updated_at: "", ...over,
});

const p = (over: Partial<Petition>): Petition => ({
  id: "1", number: "1", petitioner: "x", petitioner_type: "detinut", subject: null,
  received_date: "2026-07-01", response_deadline: null, status: "in_examinare",
  response: null, response_date: null, assignee_id: null, created_by: "u",
  created_at: "", updated_at: "", ...over,
});

const today = new Date(2026, 6, 28); // 28 iul 2026

describe("taskStats", () => {
  it("numără total și active (nefinalizate)", () => {
    const s = taskStats([t({}), t({ status: "in_progress" }), t({ status: "done" })], today);
    expect(s.total).toBe(3);
    expect(s.active).toBe(2);
  });
  it("numără restante (termen trecut, nefinalizate)", () => {
    const s = taskStats([
      t({ due_date: "2026-07-20" }),
      t({ due_date: "2026-07-20", status: "done" }),
      t({ due_date: "2026-08-10" }),
    ], today);
    expect(s.overdue).toBe(1);
  });
  it("numără scadente în 7 zile (azi inclusiv, fără restante)", () => {
    const s = taskStats([
      t({ due_date: "2026-07-28" }),
      t({ due_date: "2026-08-04" }),
      t({ due_date: "2026-08-05" }),
      t({ due_date: "2026-07-20" }),
    ], today);
    expect(s.dueSoon).toBe(2);
  });
  it("listă goală", () => {
    expect(taskStats([], today)).toEqual({
      total: 0, active: 0, done: 0, waiting: 0, dueSoon: 0, overdue: 0,
    });
  });
});

describe("taskStats — finalizate", () => {
  it("numără sarcinile finalizate", () => {
    const s = taskStats(
      [t({}), t({ status: "done" }), t({ status: "done" }), t({ status: "in_progress" })],
      today,
    );
    expect(s.done).toBe(2);
    expect(s.active).toBe(2);
    expect(s.total).toBe(4);
  });
});

describe("petitionStats", () => {
  it("numără total și în examinare", () => {
    const s = petitionStats([p({}), p({ status: "solutionat" })], today);
    expect(s.total).toBe(2);
    expect(s.open).toBe(1);
  });
  it("numără restante și scadente în 7 zile (doar cele în examinare)", () => {
    const s = petitionStats([
      p({ response_deadline: "2026-07-20" }),
      p({ response_deadline: "2026-07-20", status: "solutionat" }),
      p({ response_deadline: "2026-07-30" }),
      p({ response_deadline: "2026-09-01" }),
    ], today);
    expect(s.overdue).toBe(1);
    expect(s.dueSoon).toBe(1);
  });
  it("listă goală", () => {
    expect(petitionStats([], today)).toEqual({ total: 0, open: 0, solved: 0, dueSoon: 0, overdue: 0 });
  });
});

describe("petitionStats — soluționate", () => {
  it("numără petițiile soluționate", () => {
    const s = petitionStats([p({}), p({ status: "solutionat" }), p({ status: "solutionat" })], today);
    expect(s.solved).toBe(2);
    expect(s.open).toBe(1);
    expect(s.total).toBe(3);
  });
});

describe("countsByAssignee", () =>{
  const profiles = [prof("a", "Ana"), prof("b", "Bogdan")];

  it("grupează și sortează descrescător", () => {
    const r = countsByAssignee(
      [{ assignee_id: "b" }, { assignee_id: "a" }, { assignee_id: "b" }],
      profiles,
    );
    expect(r).toEqual([
      { id: "b", name: "Bogdan", count: 2, overdue: 0 },
      { id: "a", name: "Ana", count: 1, overdue: 0 },
    ]);
  });

  it("pune Neatribuit la final", () => {
    const r = countsByAssignee(
      [{ assignee_id: null }, { assignee_id: null }, { assignee_id: "a" }],
      profiles,
    );
    expect(r.map((x) => x.name)).toEqual(["Ana", "Neatribuit"]);
    expect(r[1].count).toBe(2);
  });

  it("tratează profil lipsă ca Neatribuit", () => {
    const r = countsByAssignee([{ assignee_id: "zzz" }], profiles);
    expect(r).toEqual([{ id: null, name: "Neatribuit", count: 1, overdue: 0 }]);
  });

  it("nume lipsă → (fără nume)", () => {
    const r = countsByAssignee([{ assignee_id: "c" }], [prof("c", null)]);
    expect(r[0].name).toBe("(fără nume)");
  });

  it("la egalitate sortează alfabetic", () => {
    const r = countsByAssignee([{ assignee_id: "b" }, { assignee_id: "a" }], profiles);
    expect(r.map((x) => x.name)).toEqual(["Ana", "Bogdan"]);
  });

  it("listă goală", () => {
    expect(countsByAssignee([], profiles)).toEqual([]);
  });

  it("numără restanțele per persoană cu predicatul dat", () => {
    const items = [
      { assignee_id: "a", late: true },
      { assignee_id: "a", late: false },
      { assignee_id: "b", late: true },
      { assignee_id: "b", late: true },
    ];
    // count egal (2 vs 2) → la egalitate sortarea e alfabetică
    const r = countsByAssignee(items, profiles, (i) => i.late);
    expect(r).toEqual([
      { id: "a", name: "Ana", count: 2, overdue: 1 },
      { id: "b", name: "Bogdan", count: 2, overdue: 2 },
    ]);
  });
});

describe("isTaskOverdue / isPetitionOverdue", () => {
  it("sarcină restantă doar dacă nu e finalizată", () => {
    expect(isTaskOverdue(t({ due_date: "2026-07-20" }), today)).toBe(true);
    expect(isTaskOverdue(t({ due_date: "2026-07-20", status: "done" }), today)).toBe(false);
    expect(isTaskOverdue(t({ due_date: "2026-08-10" }), today)).toBe(false);
    expect(isTaskOverdue(t({ due_date: null }), today)).toBe(false);
  });
  it("în așteptare nu e restantă, oricât de vechi ar fi termenul", () => {
    // Întârzierea e a instanței, nu a responsabilului.
    const late = { due_date: "2020-01-01", status: "waiting" } as const;
    expect(isTaskOverdue(t({ ...late }), today)).toBe(false);
    expect(isTaskOverdue(t({ ...late, status: "in_progress" }), today)).toBe(true);
  });

  it("petiție restantă doar dacă e în examinare", () => {
    expect(isPetitionOverdue(p({ response_deadline: "2026-07-20" }), today)).toBe(true);
    expect(
      isPetitionOverdue(p({ response_deadline: "2026-07-20", status: "solutionat" }), today),
    ).toBe(false);
    expect(isPetitionOverdue(p({ response_deadline: "2026-09-01" }), today)).toBe(false);
  });
});

describe("groupByAssignee", () => {
  const ana = prof("ana", "Ana Cojocari");
  const nat = prof("nat", "Natalia Spinei");

  it("grupează păstrând elementele, nu doar numărul", () => {
    const rows = groupByAssignee(
      [t({ id: "1", assignee_id: "ana" }), t({ id: "2", assignee_id: "ana" })],
      [ana],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].items.map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("cifrele grupurilor se adună la totalul general", () => {
    // Proprietatea care justifică gruparea: defalcarea nu poate contrazice cardul.
    const tasks = [
      t({ assignee_id: "ana", status: "done" }),
      t({ assignee_id: "ana", status: "waiting" }),
      t({ assignee_id: "nat", status: "todo" }),
      t({ assignee_id: null, status: "todo" }),
    ];
    const groups = groupByAssignee(tasks, [ana, nat]);
    const sum = (pick: (s: ReturnType<typeof taskStats>) => number) =>
      groups.reduce((n, g) => n + pick(taskStats(g.items)), 0);
    const total = taskStats(tasks);
    expect(sum((s) => s.total)).toBe(total.total);
    expect(sum((s) => s.done)).toBe(total.done);
    expect(sum((s) => s.waiting)).toBe(total.waiting);
  });

  it("descrescător după număr, „Neatribuit” la final", () => {
    const rows = groupByAssignee(
      [
        t({ assignee_id: null }),
        t({ assignee_id: "nat" }),
        t({ assignee_id: "ana" }),
        t({ assignee_id: "ana" }),
      ],
      [ana, nat],
    );
    expect(rows.map((r) => r.name)).toEqual(["Ana Cojocari", "Natalia Spinei", "Neatribuit"]);
  });

  it("responsabilul care nu mai există ajunge la „Neatribuit”", () => {
    const rows = groupByAssignee([t({ assignee_id: "sters" })], [ana]);
    expect(rows.map((r) => r.name)).toEqual(["Neatribuit"]);
  });
});
