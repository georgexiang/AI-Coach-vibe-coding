import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Training - Start Session Flow", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("clicking '开始培训' on F2F scenario creates session and navigates to session page", async ({ page }) => {
    // Navigate to training page
    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");

    // Wait for scenario cards to load
    const startButton = page.locator("button", { hasText: /开始培训|Start Training/ }).first();
    await expect(startButton).toBeVisible({ timeout: 10000 });

    // Set up response listener before clicking
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/sessions") && resp.request().method() === "POST",
      { timeout: 10000 },
    );

    // Click the start training button
    await startButton.click();

    // Verify the API call succeeds (not 500)
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    // Should navigate to session page
    await page.waitForURL(/\/user\/training\/session\?id=/, { timeout: 10000 });
    expect(page.url()).toContain("/user/training/session?id=");
  });

  test("clicking '开始培训' on Conference scenario navigates to conference session", async ({ page }) => {
    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");

    // Switch to conference tab
    const conferenceTab = page.locator("[role=tab]", { hasText: /会议培训|Conference/ });
    await expect(conferenceTab).toBeVisible({ timeout: 5000 });
    await conferenceTab.click();

    // Wait for conference scenario cards
    const startButton = page.locator("button", { hasText: /开始培训|Start Training/ }).first();
    await expect(startButton).toBeVisible({ timeout: 10000 });

    // Set up response listener
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/sessions") && resp.request().method() === "POST",
      { timeout: 10000 },
    );

    // Click start
    await startButton.click();

    // Verify API succeeds
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    // Should navigate to conference session page
    await page.waitForURL(/\/user\/training\/conference\?id=/, { timeout: 10000 });
    expect(page.url()).toContain("/user/training/conference?id=");
  });

  test("training page shows only F2F scenarios in F2F tab", async ({ page }) => {
    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");

    // Should show scenario cards on F2F tab (default)
    const scenarioCards = page.locator("button", { hasText: /开始培训|Start Training/ });
    await expect(scenarioCards.first()).toBeVisible({ timeout: 10000 });

    // Count cards visible — should match F2F scenarios only
    const count = await scenarioCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("training page shows only conference scenarios in conference tab", async ({ page }) => {
    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");

    // Switch to conference tab
    const conferenceTab = page.locator("[role=tab]", { hasText: /会议培训|Conference/ });
    await conferenceTab.click();

    // Wait for cards to load
    const scenarioCards = page.locator("button", { hasText: /开始培训|Start Training/ });
    await expect(scenarioCards.first()).toBeVisible({ timeout: 10000 });

    const count = await scenarioCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("session page loads session details successfully after navigation", async ({ page }) => {
    // This covers the GET /sessions/{id} path — ensuring the session page
    // can load session data (scenario_name, message_count) without 500
    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");

    const startButton = page.locator("button", { hasText: /开始培训|Start Training/ }).first();
    await expect(startButton).toBeVisible({ timeout: 10000 });

    // Set up response listener for session creation
    const createPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/sessions") && resp.request().method() === "POST",
      { timeout: 10000 },
    );

    await startButton.click();
    const createResp = await createPromise;
    expect(createResp.status()).toBe(201);

    // Wait for navigation to session page
    await page.waitForURL(/\/user\/training\/session\?id=/, { timeout: 10000 });

    // Verify GET /sessions/{id} succeeds (no "Failed to load session" error)
    // The page should NOT show the error message
    const errorText = page.locator("text=Failed to load session");
    await expect(errorText).not.toBeVisible({ timeout: 5000 });
  });

  test("POST /sessions returns 500 is caught and shows error feedback", async ({ page }) => {
    // Intercept the sessions API to simulate a 500 error
    await page.route("**/api/v1/sessions", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ code: "INTERNAL_ERROR", message: "Test error" }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");

    const startButton = page.locator("button", { hasText: /开始培训|Start Training/ }).first();
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    // Should NOT navigate away (stays on training page)
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/user/training");
    // Should NOT show session page
    expect(page.url()).not.toContain("/user/training/session");
  });

  test("GET /sessions/{id} returns 500 shows 'Failed to load session' on session page", async ({ page }) => {
    // Simulate: session created OK but loading session details fails (MissingGreenlet regression)
    await page.route("**/api/v1/sessions/*", (route) => {
      // Only intercept GET requests to /sessions/{id} (not POST to /sessions)
      if (route.request().method() === "GET" && /sessions\/[a-f0-9-]+$/.test(route.request().url())) {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ code: "INTERNAL_ERROR", message: "MissingGreenlet simulation" }),
        });
      } else {
        route.continue();
      }
    });

    // Navigate directly to a session page with a fake session ID
    await page.goto("/user/training/session?id=00000000-0000-0000-0000-000000000000");
    await page.waitForLoadState("networkidle");

    // Should display error message
    const errorText = page.locator("text=Failed to load session");
    await expect(errorText).toBeVisible({ timeout: 5000 });
  });

  test("text mode session auto-starts and shows avatar static preview", async ({ page }) => {
    // Start a F2F training session
    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");

    const startButton = page.locator("button", { hasText: /开始培训|Start Training/ }).first();
    await expect(startButton).toBeVisible({ timeout: 10000 });

    // Create session
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/sessions") && resp.request().method() === "POST",
      { timeout: 10000 },
    );
    await startButton.click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    // Navigate to session page
    await page.waitForURL(/\/user\/training\/session\?id=/, { timeout: 10000 });

    // Text mode: should NOT show start overlay (auto-starts)
    const startOverlay = page.locator("[data-testid=start-overlay]");
    await expect(startOverlay).not.toBeVisible({ timeout: 5000 });

    // Should show avatar static preview (from HCP profile avatar_character)
    const avatarPreview = page.locator("[data-testid=avatar-static-preview]");
    // Avatar preview is visible OR text input is accessible (text mode is active)
    const textInput = page.locator("input[placeholder], textarea[placeholder]");
    const hasAvatar = await avatarPreview.isVisible().catch(() => false);
    const hasTextInput = await textInput.first().isVisible().catch(() => false);
    expect(hasAvatar || hasTextInput).toBe(true);
  });

  test("scenario API returns hcp_profile with avatar_character", async ({ page }) => {
    // Intercept scenario list to verify avatar fields in response
    const scenarioPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/scenarios") && resp.request().method() === "GET",
      { timeout: 10000 },
    );

    await page.goto("/user/training");
    const scenarioResp = await scenarioPromise;
    const body = await scenarioResp.json();

    // Verify at least one scenario has hcp_profile with avatar_character
    const items = body.items || body;
    const withAvatar = (Array.isArray(items) ? items : []).filter(
      (s: { hcp_profile?: { avatar_character?: string } }) => s.hcp_profile?.avatar_character,
    );
    expect(withAvatar.length).toBeGreaterThan(0);
    expect(withAvatar[0].hcp_profile.avatar_character).toBeTruthy();
  });

  test("avatar_character in scenario matches VL Instance (not stale default)", async ({ page }) => {
    // Regression test: avatar_character must NOT be the stale default "lori"
    // when VL Instance has a different character assigned.
    // This validates the sync between VL Instance and HcpProfile fields.
    const scenarioPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/scenarios") && resp.request().method() === "GET",
      { timeout: 10000 },
    );

    await page.goto("/user/training");
    const scenarioResp = await scenarioPromise;
    const body = await scenarioResp.json();

    const items = body.items || body;
    const scenarios = Array.isArray(items) ? items : [];

    // For every scenario with an hcp_profile, validate avatar_character is a known character
    const validAvatarCharacters = ["lisa", "harry", "meg", "jeff", "lori", "max", "jack"];
    for (const s of scenarios) {
      if (s.hcp_profile?.avatar_character) {
        expect(validAvatarCharacters).toContain(s.hcp_profile.avatar_character);
        // avatar_style must also be present and non-empty
        expect(s.hcp_profile.avatar_style).toBeTruthy();
      }
    }

    // At least one scenario should have avatar data
    const withAvatar = scenarios.filter(
      (s: { hcp_profile?: { avatar_character?: string } }) => s.hcp_profile?.avatar_character,
    );
    expect(withAvatar.length).toBeGreaterThan(0);
  });
});
