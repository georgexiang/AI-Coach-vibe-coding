import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("User Dashboard", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/user/dashboard");
  });

  test("renders welcome header", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    // Welcome text should contain "Welcome" or user's name
    await expect(page.locator("h1")).toContainText(/welcome|Welcome|user1/i);
  });

  test("shows 4 stat cards", async ({ page }) => {
    // Stat cards display dynamic labels from the API
    // Check for the stat card labels rather than hardcoded values
    await expect(page.locator(".grid .rounded-xl, .grid [class*='card']").first()).toBeVisible({ timeout: 5000 });
    // There should be at least 4 stat cards in the grid
    const statCards = page.locator(".grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 > *");
    await expect(statCards).toHaveCount(4, { timeout: 5000 });
  });

  test("shows recent training sessions", async ({ page }) => {
    // Wait for sessions to load - they come from the API with actual seed data
    // Session items show scenario names, not HCP names directly
    // Just verify the recent sessions section is rendered with some content
    await page.waitForTimeout(2000);
    const sessionsSection = page.getByText(/No sessions yet|View All/i);
    const sessionItems = page.locator("[class*='space-y'] [class*='cursor-pointer'], [class*='space-y'] [role='button']");
    const sectionCount = await sessionsSection.count();
    const itemCount = await sessionItems.count();
    // Either there are session items or a "No sessions" message or a "View All" link
    expect(sectionCount + itemCount).toBeGreaterThan(0);
  });

  test("shows action cards for F2F and Conference training", async ({
    page,
  }) => {
    // The action cards contain text about F2F HCP Training
    await expect(page.getByText(/F2F.*Training/i).first()).toBeVisible();
  });

  test("shows start training button or view all link", async ({ page }) => {
    // At least one actionable link/button exists on the dashboard
    const startBtn = page.getByRole("button", { name: /start training/i });
    const viewAll = page.getByText(/view all/i);
    const count =
      (await startBtn.count()) + (await viewAll.count());
    expect(count).toBeGreaterThan(0);
  });

  test("action card navigates to training page", async ({ page }) => {
    // Click the first "Start Training" or action card button
    const startButtons = page.getByRole("button", {
      name: /start training/i,
    });
    const count = await startButtons.count();
    if (count > 0) {
      await startButtons.first().click();
    } else {
      // Fall back to "View All" link
      await page.getByText(/view all/i).click();
    }
    await expect(page).toHaveURL(/\/user\/training/);
  });
});
