import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("User Reports Page", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/user/reports");
  });

  test("renders page with heading", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText(/Analytics & Reports/i);
  });

  test("shows summary stat cards", async ({ page }) => {
    // The page shows 4 stat cards: Total Sessions, Avg Score, This Week, Improvement
    // Use heading role to disambiguate from chart legends
    await expect(page.getByRole("heading", { name: "Total Sessions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Avg Score" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "This Week" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Improvement" })).toBeVisible();
  });

  test("shows chart sections (Performance Trend and Skill analysis)", async ({
    page,
  }) => {
    // Chart headings are h4 elements
    await expect(page.getByRole("heading", { name: /Performance Trend/i })).toBeVisible();
    // The second chart may be "Skill Radar" or "Skill Gap Analysis" depending on translation
    await expect(page.getByRole("heading", { name: /Skill/i })).toBeVisible();
  });

  test("shows export buttons", async ({ page }) => {
    await expect(page.getByText(/Print Report/i)).toBeVisible();
    await expect(page.getByText(/Export Excel/i)).toBeVisible();
  });

  test("page renders fully without errors", async ({ page }) => {
    // The page should render completely with all sections
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Verify that the stat card values are rendered (numbers from the API)
    // There should be at least one paragraph with a number value
    const statValues = page.locator("p.text-3xl");
    const count = await statValues.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
