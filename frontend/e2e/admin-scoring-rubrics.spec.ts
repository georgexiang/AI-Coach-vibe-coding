import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Admin Scoring Rubrics Page", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/scoring-rubrics");
  });

  test("renders page with heading", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText(/Scoring Rubrics/i);
  });

  test("shows rubric list table or empty state", async ({ page }) => {
    // Either the table component renders or an empty state message appears
    const table = page.locator("table");
    const emptyState = page.getByText(/No Scoring Rubrics/i);
    const tableCount = await table.count();
    const emptyCount = await emptyState.count();
    expect(tableCount + emptyCount).toBeGreaterThan(0);
  });

  test("create rubric button exists", async ({ page }) => {
    await expect(page.getByText(/Create Rubric/i)).toBeVisible();
  });

  test("filter dropdown exists and works", async ({ page }) => {
    // The filter Select should be visible (it shows "All" by default)
    const filterTrigger = page.locator("button").filter({ hasText: "All" }).first();
    await expect(filterTrigger).toBeVisible();

    // Click to open the dropdown
    await filterTrigger.click();
    await page.waitForTimeout(300);

    // Options should appear
    await expect(page.getByRole("option", { name: /Face-to-Face/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /Conference/i })).toBeVisible();
  });

  test("clicking create rubric opens editor dialog", async ({ page }) => {
    await page.getByText(/Create Rubric/i).click();
    await page.waitForTimeout(300);

    // Editor dialog/sheet should open with form fields
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });
  });
});
