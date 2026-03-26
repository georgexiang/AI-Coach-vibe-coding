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

  test("displays scenario cards or empty state", async ({ page }) => {
    // Wait for scenarios to load from API
    await page.waitForTimeout(2000);
    // The page either shows scenario cards or an empty state message
    const cards = page.locator(".grid > div");
    const emptyState = page.getByText(/No Scenarios Available|not been configured/i);
    const cardCount = await cards.count();
    const emptyCount = await emptyState.count();
    // Either scenario cards or empty state should be visible
    expect(cardCount + emptyCount).toBeGreaterThan(0);
  });

  test("search filter is present", async ({ page }) => {
    // The search input should always be visible
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
    // Type something and verify input works
    await searchInput.fill("test search");
    await expect(searchInput).toHaveValue("test search");
    // Clear search
    await searchInput.clear();
  });

  test("shows difficulty badges or empty state", async ({ page }) => {
    // Wait for scenarios to load
    await page.waitForTimeout(2000);
    // If scenarios are loaded, difficulty badges should be visible
    // Otherwise the empty state message is shown
    const hardBadge = page.getByText("hard").first();
    const emptyState = page.getByText(/No Scenarios Available|not been configured/i);
    const hardCount = await hardBadge.count();
    const emptyCount = await emptyState.count();
    // Either difficulty badges or empty state should be visible
    expect(hardCount + emptyCount).toBeGreaterThan(0);
  });

  test("Start Training button navigates to training session when scenarios exist", async ({
    page,
  }) => {
    // Wait for scenarios to load
    await page.waitForTimeout(2000);
    // The ScenarioCard has a "Start Training" button (only if scenarios loaded)
    const startButtons = page.getByRole("button", {
      name: /start training/i,
    });
    const count = await startButtons.count();
    if (count > 0) {
      await startButtons.first().click();
      await expect(page).toHaveURL(/\/user\/training\/session/, { timeout: 10000 });
    } else {
      // If no scenarios, the page should show empty state heading
      await expect(page.getByRole("heading", { name: /No Scenarios Available/i })).toBeVisible();
    }
  });

  test("tab switching works", async ({ page }) => {
    const conferenceTab = page.getByRole("tab", { name: /Conference/i });
    await conferenceTab.click();
    await page.waitForTimeout(500);
    // After switching tab, the page should still render correctly
    await expect(page.locator("h1")).toBeVisible();
    // Switch back to F2F
    const f2fTab = page.getByRole("tab", { name: /F2F/i });
    await f2fTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator("h1")).toBeVisible();
  });
});
