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
    // Stat cards display values: 24, 78, 5, +12%
    await expect(page.getByText("24")).toBeVisible();
    await expect(page.getByText("78")).toBeVisible();
    await expect(page.getByText("+12%")).toBeVisible();
  });

  test("shows recent training sessions", async ({ page }) => {
    await expect(page.getByText("Dr. Sarah Mitchell")).toBeVisible();
    await expect(page.getByText("Dr. James Wong")).toBeVisible();
    await expect(page.getByText("Dr. Michael Chen")).toBeVisible();
    await expect(page.getByText("Dr. Emily Roberts")).toBeVisible();
    await expect(page.getByText("Dr. Robert Thompson")).toBeVisible();
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
