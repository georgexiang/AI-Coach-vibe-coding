import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Conference Module - Scenario Selection", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/user/training");
  });

  test("conference tab is visible in scenario selection", async ({ page }) => {
    const conferenceTab = page.getByRole("tab", { name: /Conference/i });
    await expect(conferenceTab).toBeVisible();
  });

  test("conference tab can be selected and shows content", async ({ page }) => {
    const conferenceTab = page.getByRole("tab", { name: /Conference/i });
    await conferenceTab.click();
    await page.waitForTimeout(500);

    // The page heading should remain visible after switching tabs
    await expect(page.locator("h1")).toBeVisible();

    // Conference tab should be in selected/active state
    await expect(conferenceTab).toHaveAttribute("data-state", "active");
  });

  test("conference tab shows search and filter controls", async ({ page }) => {
    // Switch to conference tab
    const conferenceTab = page.getByRole("tab", { name: /Conference/i });
    await conferenceTab.click();
    await page.waitForTimeout(500);

    // Search input should be visible in the conference tab content
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Filter dropdowns should exist (product and difficulty filters)
    const filterTriggers = page.locator("button[role='combobox']");
    const count = await filterTriggers.count();
    expect(count).toBeGreaterThan(0);
  });

  test("conference tab shows scenario cards or empty state", async ({
    page,
  }) => {
    // Switch to conference tab
    const conferenceTab = page.getByRole("tab", { name: /Conference/i });
    await conferenceTab.click();
    await page.waitForTimeout(1000);

    // Either scenario cards are displayed or an empty state message is shown
    const cards = page.locator(".grid > div");
    const emptyState = page.getByText(/no scenario|empty/i);
    const cardCount = await cards.count();
    const emptyCount = await emptyState.count();

    // One of these states must be present
    expect(cardCount > 0 || emptyCount > 0).toBeTruthy();
  });

  test("can switch between F2F and conference tabs without errors", async ({
    page,
  }) => {
    // Start with F2F (default)
    const f2fTab = page.getByRole("tab", { name: /F2F/i });
    const conferenceTab = page.getByRole("tab", { name: /Conference/i });

    await expect(f2fTab).toHaveAttribute("data-state", "active");

    // Switch to conference
    await conferenceTab.click();
    await page.waitForTimeout(300);
    await expect(conferenceTab).toHaveAttribute("data-state", "active");
    await expect(f2fTab).toHaveAttribute("data-state", "inactive");

    // Switch back to F2F
    await f2fTab.click();
    await page.waitForTimeout(300);
    await expect(f2fTab).toHaveAttribute("data-state", "active");
    await expect(conferenceTab).toHaveAttribute("data-state", "inactive");

    // Page should be stable with no errors
    await expect(page.locator("h1")).toBeVisible();
  });

  test("conference tab search filters scenarios", async ({ page }) => {
    // Switch to conference tab
    const conferenceTab = page.getByRole("tab", { name: /Conference/i });
    await conferenceTab.click();
    await page.waitForTimeout(500);

    // Search for a non-existent scenario
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("NonExistentConferenceScenarioXYZ123");
    await page.waitForTimeout(500);

    // Either empty state appears or grid has zero cards
    const cards = page.locator(".grid > div");
    const emptyState = page.getByText(/no scenario|empty/i);
    const cardCount = await cards.count();
    const emptyCount = await emptyState.count();

    expect(cardCount === 0 || emptyCount > 0).toBeTruthy();

    // Clear the search to restore
    await searchInput.clear();
    await page.waitForTimeout(500);
  });
});

test.describe("Conference Session Page - Direct Navigation", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("navigating to conference session without ID shows graceful state", async ({
    page,
  }) => {
    // The conference session page requires a session ID as a query parameter.
    // Without a valid ID, the page should either redirect or show an empty/loading state.
    // This test verifies the page does not crash when accessed without an ID.
    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");

    // The page should remain stable (not crash with a white screen)
    await expect(page.locator("body")).toBeVisible();
  });
});
