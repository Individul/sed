import { describe, it, expect } from "vitest";
import {
  canEditComment,
  canDeleteComment,
  canDeleteTask,
  canEditTask,
  canFinalizeTask,
  canReassignTask,
  canEditPetition,
  canReassignPetition,
  canDeletePetition,
} from "./permissions";

describe("canEditComment", () => {
  it("autorul poate edita", () => expect(canEditComment("u1", { author_id: "u1" })).toBe(true));
  it("alt user nu poate", () => expect(canEditComment("u2", { author_id: "u1" })).toBe(false));
});

const task = (over: Partial<{ created_by: string; assignee_id: string | null }>) => ({
  created_by: "owner",
  assignee_id: null as string | null,
  ...over,
});

describe("canDeleteTask", () => {
  it("adminul poate șterge orice", () => expect(canDeleteTask("x", true, task({}))).toBe(true));
  it("creatorul poate șterge", () => expect(canDeleteTask("owner", false, task({}))).toBe(true));
  it("altcineva nu poate", () => expect(canDeleteTask("other", false, task({}))).toBe(false));
  it("asignatul (dar nu creator) nu poate șterge", () =>
    expect(canDeleteTask("a", false, task({ assignee_id: "a" }))).toBe(false));
});

describe("canEditTask", () => {
  it("adminul poate edita orice", () => expect(canEditTask("x", true, task({}))).toBe(true));
  it("creatorul poate edita", () => expect(canEditTask("owner", false, task({}))).toBe(true));
  it("asignatul poate edita", () =>
    expect(canEditTask("a", false, task({ assignee_id: "a" }))).toBe(true));
  it("altcineva nu poate", () => expect(canEditTask("other", false, task({}))).toBe(false));
});

describe("canFinalizeTask", () => {
  it("adminul poate finaliza orice", () =>
    expect(canFinalizeTask("x", true, task({}))).toBe(true));
  it("creatorul poate finaliza", () =>
    expect(canFinalizeTask("owner", false, task({}))).toBe(true));
  it("asignatul poate finaliza", () =>
    expect(canFinalizeTask("a", false, task({ assignee_id: "a" }))).toBe(true));
  it("altcineva nu poate finaliza", () =>
    expect(canFinalizeTask("other", false, task({}))).toBe(false));
});

describe("canReassignTask", () => {
  it("doar adminul poate reatribui", () => {
    expect(canReassignTask(true)).toBe(true);
    expect(canReassignTask(false)).toBe(false);
  });
});

describe("canDeleteComment", () => {
  it("autorul poate", () => expect(canDeleteComment("u1", false, { author_id: "u1" })).toBe(true));
  it("adminul poate șterge al oricui", () =>
    expect(canDeleteComment("u2", true, { author_id: "u1" })).toBe(true));
  it("alt user non-admin nu poate", () =>
    expect(canDeleteComment("u2", false, { author_id: "u1" })).toBe(false));
});

describe("canEditPetition / canDeletePetition", () => {
  const pet = { created_by: "owner", assignee_id: null as string | null };

  it("adminul poate edita și șterge orice", () => {
    expect(canEditPetition("x", true, pet)).toBe(true);
    expect(canDeletePetition("x", true, pet)).toBe(true);
  });
  it("creatorul poate edita și șterge", () => {
    expect(canEditPetition("owner", false, pet)).toBe(true);
    expect(canDeletePetition("owner", false, pet)).toBe(true);
  });
  it("responsabilul poate edita, dar nu șterge", () => {
    const assigned = { created_by: "owner", assignee_id: "a" };
    expect(canEditPetition("a", false, assigned)).toBe(true);
    expect(canDeletePetition("a", false, assigned)).toBe(false);
  });
  it("un străin nu poate nimic", () => {
    expect(canEditPetition("x", false, pet)).toBe(false);
    expect(canDeletePetition("x", false, pet)).toBe(false);
  });
});

describe("canReassignPetition", () => {
  const pet = { created_by: "owner" };

  it("adminul și creatorul pot schimba responsabilul", () => {
    expect(canReassignPetition("x", true, pet)).toBe(true);
    expect(canReassignPetition("owner", false, pet)).toBe(true);
  });

  it("responsabilul care nu e creator NU poate — baza l-ar refuza oricum", () => {
    // WITH CHECK din 0012 evaluează rândul nou: mutând petiția pe altcineva,
    // el n-ar mai fi nici creator, nici responsabil. Poarta din interfață
    // trebuie să cadă exact unde cade și cea din bază.
    expect(canReassignPetition("responsabil", false, pet)).toBe(false);
  });
});
