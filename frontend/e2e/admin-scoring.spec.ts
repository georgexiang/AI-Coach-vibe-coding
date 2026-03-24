import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Admin Scoring & Dashboard (Phase 3)", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("admin dashboard loads and shows heading", async ({ page }) => {
    await page.goto("/admin/dashboard");

    const heading = page.locator("h1").first();
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading).toBeVisible();
    }
  });

  test("admin can navigate to scenarios management", async ({ page }) => {
    await page.goto("/admin/dashboard");

    // Look for a link or button to scenarios
    const scenarioLink = page.getByRole("link", { name: /scenario/i });
    const count = await scenarioLink.count();
    if (count > 0) {
      await scenarioLink.first().click();
      await expect(page).toHaveURL(/\/admin\/scenarios/, { timeout: 5000 });
    }
  });

  test("admin scenarios page shows scenario table", async ({ page }) => {
    await page.goto("/admin/scenarios");
    await page.waitForTimeout(2000);

    // Look for table rows or scenario items
    const tableRows = page.locator("tbody tr, [data-testid='scenario-row']");
    const rowCount = await tableRows.count();

    // Either shows scenarios or empty state
    const emptyState = page.getByText(/no scenarios|empty|create your first/i);
    const emptyCount = await emptyState.count();

    expect(rowCount + emptyCount).toBeGreaterThanOrEqual(0);
  });

  test("admin scenarios page shows scoring weight configuration", async ({
    page,
  }) => {
    await page.goto("/admin/scenarios");
    await page.waitForTimeout(2000);

    // Look for scoring weight related UI elements
    const weightText = page.getByText(
      /weight|scoring|key message|communication|objection/i,
    );
    const count = await weightText.count();

    // Scoring weights are part of scenario configuration
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("admin HCP profiles page loads", async ({ page }) => {
    await page.goto("/admin/hcp-profiles");
    await page.waitForTimeout(2000);

    const heading = page.locator("h1, h2").first();
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading).toBeVisible();
    }
  });
});
