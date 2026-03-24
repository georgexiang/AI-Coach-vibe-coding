import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Scenario Selection", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/user/training");
  });

  test("renders scenario selection heading", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
  });

  test("shows F2F and Conference tabs", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /F2F/i })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Conference/i })
    ).toBeVisible();
  });

  test("displays 6 HCP profile cards", async ({ page }) => {
    await expect(page.getByText("Dr. Wang Wei")).toBeVisible();
    await expect(page.getByText("Dr. Li Na")).toBeVisible();
    await expect(page.getByText("Dr. Zhang Ming")).toBeVisible();
    await expect(page.getByText("Dr. Chen Hui")).toBeVisible();
    await expect(page.getByText("Dr. Liu Yang")).toBeVisible();
    await expect(page.getByText("Dr. Zhao Lin")).toBeVisible();
  });

  test("search filter narrows results", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("Wang");
    // Only Dr. Wang Wei should remain visible
    await expect(page.getByText("Dr. Wang Wei")).toBeVisible();
    await expect(page.getByText("Dr. Li Na")).not.toBeVisible();
    await expect(page.getByText("Dr. Zhang Ming")).not.toBeVisible();
  });

  test("shows difficulty badges", async ({ page }) => {
    await expect(page.getByText("Hard").first()).toBeVisible();
    await expect(page.getByText("Easy").first()).toBeVisible();
    await expect(page.getByText("Medium").first()).toBeVisible();
  });

  test("Start Training button navigates to training session", async ({
    page,
  }) => {
    const startButtons = page.getByRole("button", {
      name: /start training/i,
    });
    await startButtons.first().click();
    await expect(page).toHaveURL(/\/user\/training\/session/);
  });

  test("tab switching works", async ({ page }) => {
    const conferenceTab = page.getByRole("tab", { name: /Conference/i });
    await conferenceTab.click();
    // After switching tab, cards should still be visible (same mock data)
    await expect(page.getByText("Dr. Wang Wei")).toBeVisible();
  });
});
