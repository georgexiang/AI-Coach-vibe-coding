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
    await expect(page.locator("h1")).toContainText(/Personal Reports/i);
  });

  test("shows chart sections (Score Trend, Skill Radar, Training Frequency, Focus Areas)", async ({
    page,
  }) => {
    await expect(page.getByText("Score Trend")).toBeVisible();
    await expect(page.getByText("Skill Radar")).toBeVisible();
    await expect(page.getByText("Training Frequency")).toBeVisible();
    await expect(page.getByText("Focus Areas")).toBeVisible();
  });

  test("shows time period tabs (Week, Month, Quarter, Year)", async ({
    page,
  }) => {
    await expect(page.getByRole("tab", { name: /Week/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Month/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Quarter/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Year/i })).toBeVisible();
  });

  test("tab navigation switches active tab", async ({ page }) => {
    // Click Month tab
    const monthTab = page.getByRole("tab", { name: /Month/i });
    await monthTab.click();
    await expect(monthTab).toHaveAttribute("data-state", "active");

    // Click Quarter tab
    const quarterTab = page.getByRole("tab", { name: /Quarter/i });
    await quarterTab.click();
    await expect(quarterTab).toHaveAttribute("data-state", "active");
  });

  test("shows export buttons", async ({ page }) => {
    await expect(page.getByText(/Print Report/i)).toBeVisible();
    await expect(page.getByText(/Export Excel/i)).toBeVisible();
  });

  test("shows focus areas content", async ({ page }) => {
    // Use more specific selectors to avoid matching SVG tspan in the radar chart
    await expect(
      page.getByRole("paragraph").filter({ hasText: "Product Knowledge" }),
    ).toBeVisible();
    await expect(
      page.getByRole("paragraph").filter({ hasText: "Clinical Discussion" }),
    ).toBeVisible();
    await expect(
      page.getByRole("paragraph").filter({ hasText: "Objection Handling" }),
    ).toBeVisible();
  });
});
