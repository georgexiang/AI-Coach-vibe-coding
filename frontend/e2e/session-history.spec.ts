import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Session History Page", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/user/history");
  });

  test("renders page with heading", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText(/Session History/i);
  });

  test("shows history table or empty state", async ({ page }) => {
    // Wait for loading to finish (the page shows a spinner while loading)
    await page.waitForTimeout(2000);

    // Either we get a table with session data, or an empty state message
    const table = page.locator("table");
    const emptyState = page.getByText(/No scored sessions yet/i);
    const tableCount = await table.count();
    const emptyCount = await emptyState.count();
    expect(tableCount + emptyCount).toBeGreaterThan(0);
  });

  test("shows search input", async ({ page }) => {
    // Wait for loading to finish
    await page.waitForTimeout(2000);

    // If there's data, search input should be visible
    // If empty state, search may not appear, so we check both scenarios
    const searchInput = page.getByPlaceholder(/Search scenarios/i);
    const emptyState = page.getByText(/No scored sessions yet/i);
    const searchCount = await searchInput.count();
    const emptyCount = await emptyState.count();
    // Either search is shown (data mode) or empty state is shown
    expect(searchCount + emptyCount).toBeGreaterThan(0);
  });

  test("shows filter dropdowns when data exists", async ({ page }) => {
    // Wait for loading to finish
    await page.waitForTimeout(2000);

    const emptyState = page.getByText(/No scored sessions yet/i);
    const isEmpty = (await emptyState.count()) > 0;

    if (!isEmpty) {
      // Filter selects should be present
      const selectTriggers = page.locator("button[role='combobox']");
      const count = await selectTriggers.count();
      // At least 2 filter selects (mode filter + score filter)
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test("shows results count when data exists", async ({ page }) => {
    // Wait for loading to finish
    await page.waitForTimeout(2000);

    const emptyState = page.getByText(/No scored sessions yet/i);
    const isEmpty = (await emptyState.count()) > 0;

    if (!isEmpty) {
      // Results count text should be visible
      await expect(page.getByText(/results/i)).toBeVisible();
    }
  });
});
