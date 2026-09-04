import { describe, it, expect } from "vitest";
import { filterTasks, sortByPriority, PRIORITY_ORDER } from "./task-filters";
import type { Task } from "./types";

const t = (over: Partial<Task>): Task => ({
  id: "1", title: "x", description: null, status: "todo", priority: "medium",
  due_date: null, waiting_since: null,
  assignee_id: null, created_by: "u", created_at: "", updated_at: "", ...over,
});

describe("filterTasks", () => {
  it("filtrează după status", () => {
    const tasks = [t({ id: "a", status: "todo" }), t({ id: "b", status: "done" })];
    expect(filterTasks(tasks, { status: "done" }).map(x => x.id)).toEqual(["b"]);
  });
  it("filtrează după assignee", () => {
    const tasks = [t({ id: "a", assignee_id: "u1" }), t({ id: "b", assignee_id: "u2" })];
    expect(filterTasks(tasks, { assigneeId: "u1" }).map(x => x.id)).toEqual(["a"]);
  });
  it("filtrează după prioritate", () => {
    const tasks = [t({ id: "a", priority: "low" }), t({ id: "b", priority: "high" })];
    expect(filterTasks(tasks, { priority: "high" }).map(x => x.id)).toEqual(["b"]);
  });
  it("combină filtrele (AND)", () => {
    const tasks = [
      t({ id: "a", status: "todo", assignee_id: "u1" }),
      t({ id: "b", status: "todo", assignee_id: "u2" }),
      t({ id: "c", status: "done", assignee_id: "u1" }),
    ];
    expect(filterTasks(tasks, { status: "todo", assigneeId: "u1" }).map(x => x.id)).toEqual(["a"]);
  });
  it("fără filtre întoarce tot", () => {
    const tasks = [t({ id: "a" }), t({ id: "b" })];
    expect(filterTasks(tasks, {})).toHaveLength(2);
  });
});

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shiftDays = (n: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
};

describe("filterTasks după etichetă", () => {
  it("filtrează după tagId", () => {
    const tag = { id: "t1", name: "urgent", color: "#000000" };
    const tasks = [t({ id: "a", tags: [tag] }), t({ id: "b", tags: [] })];
    expect(filterTasks(tasks, { tagId: "t1" }).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("filterTasks după căutare", () => {
  it("caută în titlu și descriere (case-insensitive)", () => {
    const tasks = [
      t({ id: "a", title: "Cumulare pedepse" }),
      t({ id: "b", title: "Altceva", description: "detaliu CUMULARE aici" }),
      t({ id: "c", title: "Nimic relevant" }),
    ];
    expect(filterTasks(tasks, { search: "cumulare" }).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("ignoră diacriticele (crilov → Crîlov)", () => {
    const tasks = [t({ id: "a", title: "Crîlov Pavel" }), t({ id: "b", title: "Altcineva" })];
    expect(filterTasks(tasks, { search: "crilov" }).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("filterTasks după termen (due)", () => {
  it("restante = termen trecut și nefinalizat", () => {
    const tasks = [
      t({ id: "a", due_date: ymd(shiftDays(-1)), status: "todo" }),
      t({ id: "b", due_date: ymd(shiftDays(-1)), status: "done" }),
      t({ id: "c", due_date: ymd(shiftDays(3)), status: "todo" }),
      t({ id: "d", due_date: null, status: "todo" }),
    ];
    expect(filterTasks(tasks, { due: "overdue" }).map((x) => x.id)).toEqual(["a"]);
  });
  it("scadente în 7 zile (fără restante)", () => {
    const tasks = [
      t({ id: "a", due_date: ymd(shiftDays(3)), status: "todo" }),
      t({ id: "b", due_date: ymd(shiftDays(30)), status: "todo" }),
      t({ id: "c", due_date: ymd(shiftDays(-1)), status: "todo" }),
    ];
    expect(filterTasks(tasks, { due: "soon" }).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("sortByPriority", () => {
  it("high înaintea medium înaintea low", () => {
    const tasks = [t({ id: "a", priority: "low" }), t({ id: "b", priority: "high" }), t({ id: "c", priority: "medium" })];
    expect(sortByPriority(tasks).map(x => x.id)).toEqual(["b", "c", "a"]);
  });
  it("nu mutează array-ul original", () => {
    const tasks = [t({ id: "a", priority: "low" }), t({ id: "b", priority: "high" })];
    const copy = [...tasks];
    sortByPriority(tasks);
    expect(tasks.map(x => x.id)).toEqual(copy.map(x => x.id));
  });
});
