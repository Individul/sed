/**
 * Happy-path E2E for the task manager.
 *
 * REQUIREMENTS (this test does NOT run against a mock — it needs the real app):
 *  1. Live Supabase env vars in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
 *     `NEXT_PUBLIC_SUPABASE_ANON_KEY`) so the dev server can talk to the backend.
 *  2. A valid authenticated `storageState` at `e2e/.auth/user.json`. Login is
 *     magic-link only (no password), so the session must be captured once and
 *     reused. See `e2e/README.md` for how to produce that file.
 *
 * Without both of the above the test cannot pass — the middleware redirects
 * unauthenticated users to `/login`, and the app has no data without Supabase.
 */
import { test, expect } from "@playwright/test";

test("create a task and add a comment", async ({ page }) => {
  const title = `Task E2E ${Date.now()}`;
  const commentBody = `Comentariu E2E ${Date.now()}`;

  // 1. Tasks list.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sarcini" })).toBeVisible();

  // 2. Open the "Sarcină nouă" dialog and create a task with a unique title.
  await page.getByRole("button", { name: "Sarcină nouă" }).click();
  await page.getByLabel("Titlu").fill(title);
  await page.getByRole("button", { name: "Creează" }).click();

  // 3. The new task shows up in the table (title is a link to its detail page).
  const taskLink = page.getByRole("link", { name: title });
  await expect(taskLink).toBeVisible();

  // 4. Open the task detail page.
  await taskLink.click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // 5. Add a comment and assert it appears in the comments list.
  await page.getByPlaceholder("Scrie un comentariu…").fill(commentBody);
  await page.getByRole("button", { name: "Adaugă comentariu" }).click();
  await expect(page.getByText(commentBody)).toBeVisible();
});
