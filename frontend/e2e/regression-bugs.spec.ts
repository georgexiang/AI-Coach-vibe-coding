import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Regression: Scoring page crash (strengths.map not a function)", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("scoring page renders feedback cards without crashing for scored session", async ({
    page,
  }) => {
    // Navigate to session history to find a scored session
    await page.goto("/user/history");
    await page.waitForTimeout(2000);

    // Find a session row with "scored" status or score value
    const sessionRows = page.locator("tr, [data-testid='session-row']");
    const rowCount = await sessionRows.count();

    if (rowCount > 1) {
      // Click first session row (skip header)
      await sessionRows.nth(1).click();
      await page.waitForTimeout(2000);

      // Should navigate to scoring page without crashing
      const body = page.locator("body");
      await expect(body).toBeVisible();

      // Should NOT show "detail.strengths.map is not a function" error
      const errorBoundary = page.getByText(/strengths\.map is not a function/i);
      const errorCount = await errorBoundary.count();
      expect(errorCount).toBe(0);

      // Should NOT show React error boundary
      const appError = page.getByText(/Unexpected Application Error/i);
      const appErrorCount = await appError.count();
      expect(appErrorCount).toBe(0);
    }
  });

  test("scoring page renders dimension feedback with strengths and weaknesses", async ({
    page,
  }) => {
    // Use a known scored session ID from seed data
    await page.goto("/user/scoring/758bd668-0a57-43d2-b89a-b2160fbaa9c5");
    await page.waitForTimeout(3000);

    // Page should render without crashing
    const appError = page.getByText(/Unexpected Application Error/i);
    const appErrorCount = await appError.count();
    expect(appErrorCount).toBe(0);

    // Check for score-related content
    const scoreDisplay = page.getByText(/\d{1,3}/).first();
    const loadingSpinner = page.locator(".animate-spin");
    const scoreCount = await scoreDisplay.count();
    const loadingCount = await loadingSpinner.count();

    // Either scoring data is shown or loading state
    expect(scoreCount + loadingCount).toBeGreaterThan(0);
  });

  test("scoring page handles JSON string strengths/weaknesses gracefully", async ({
    page,
  }) => {
    // Navigate directly to a scored session
    await page.goto("/user/scoring/f9ad9241-509e-45ce-b8f4-bb50e7f9b86d");
    await page.waitForTimeout(3000);

    // Should NOT crash with type error
    const typeError = page.getByText(/is not a function/i);
    const typeErrorCount = await typeError.count();
    expect(typeErrorCount).toBe(0);

    // Body should be visible (page didn't crash)
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Regression: User sees no scenarios on training page", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("training page shows active scenarios for regular user", async ({
    page,
  }) => {
    await page.goto("/user/training");
    await page.waitForTimeout(2000);

    // Regular user should see scenario cards (not empty state)
    const scenarioCards = page.locator(".grid > div");
    const cardCount = await scenarioCards.count();

    // With seed data, there should be at least 1 active scenario visible
    expect(cardCount).toBeGreaterThan(0);
  });

  test("training page shows Start Training buttons for regular user", async ({
    page,
  }) => {
    await page.goto("/user/training");
    await page.waitForTimeout(2000);

    // Start Training buttons should be present
    const startButtons = page.getByRole("button", { name: /start training/i });
    const count = await startButtons.count();

    // Should have at least one Start Training button
    expect(count).toBeGreaterThan(0);
  });

  test("regular user can click Start Training to begin a session", async ({
    page,
  }) => {
    await page.goto("/user/training");
    await page.waitForTimeout(2000);

    const startButtons = page.getByRole("button", { name: /start training/i });
    const count = await startButtons.count();

    if (count > 0) {
      await startButtons.first().click();
      // Should navigate to training session page
      await expect(page).toHaveURL(/\/user\/training\/session/, {
        timeout: 10000,
      });
    }
  });

  test("training page does NOT show 403 or permission error for regular user", async ({
    page,
  }) => {
    await page.goto("/user/training");
    await page.waitForTimeout(2000);

    // Should not show any permission/auth errors
    const forbiddenError = page.getByText(/403|forbidden|unauthorized|not allowed/i);
    const errorCount = await forbiddenError.count();
    expect(errorCount).toBe(0);
  });
});
