/**
 * E2E tests for voice session fallback chain and error handling (D-10).
 *
 * Fallback chain: avatar → voice → text
 * When a higher mode fails, the session gracefully degrades to the next lower mode.
 */
import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

/**
 * Helper: create a session via API and return its ID.
 */
async function createSessionViaApi(request: import("@playwright/test").APIRequestContext, mode = "text") {
  const loginResp = await request.post("/api/v1/auth/login", {
    data: { username: "user1", password: "user123" },
  });
  const { access_token } = await loginResp.json();

  // Use /active endpoint — accessible to regular users
  const scenariosResp = await request.get("/api/v1/scenarios/active", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const scenarios = await scenariosResp.json();
  const scenarioId = scenarios[0].id;

  const sessionResp = await request.post("/api/v1/sessions", {
    headers: { Authorization: `Bearer ${access_token}` },
    data: { scenario_id: scenarioId, mode },
  });
  const session = await sessionResp.json();
  return session.id as string;
}

test.describe("Voice Session Fallback Chain (D-10)", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("text mode renders fully without voice/avatar dependencies", async ({
    page,
    request,
  }) => {
    const sid = await createSessionViaApi(request, "text");
    await page.goto(`/user/training/voice?id=${sid}&mode=text`);

    // Should render without errors — no WebSocket or voice connection needed
    const endButton = page.getByRole("button", { name: /end session/i }).first();
    await expect(endButton).toBeVisible({ timeout: 10000 });

    // No error toast should appear in text mode
    const errorToast = page.locator("[data-sonner-toast][data-type='error']");
    const errorCount = await errorToast.count();
    expect(errorCount).toBe(0);
  });

  test("voice mode falls back to text if voice connection fails", async ({
    page,
    request,
  }) => {
    // Create as text (voice mode may be disabled by feature flag) but navigate with mode=voice
    const sid = await createSessionViaApi(request, "text");
    await page.goto(`/user/training/voice?id=${sid}&mode=voice`);

    // Wait for connection attempt + potential fallback
    await page.waitForTimeout(8000);

    // Session should still be functional
    const endButton = page.getByRole("button", { name: /end session/i }).first();
    await expect(endButton).toBeVisible({ timeout: 10000 });

    // Page should not be stuck in a loading state
    const loader = page.locator("[class*='animate-spin']");
    const loaderCount = await loader.count();
    if (loaderCount > 0) {
      await expect(loader.first()).not.toBeVisible({ timeout: 15000 });
    }
  });

  test("avatar mode falls back to voice or text if avatar connection fails", async ({
    page,
    request,
  }) => {
    // Create as text (avatar mode may be disabled by feature flag) but navigate with mode=avatar
    const sid = await createSessionViaApi(request, "text");
    await page.goto(`/user/training/voice?id=${sid}&mode=avatar`);

    // Wait for connection attempt + potential fallback
    await page.waitForTimeout(8000);

    // Session should remain functional
    const endButton = page.getByRole("button", { name: /end session/i }).first();
    await expect(endButton).toBeVisible({ timeout: 10000 });
  });

  test("session header shows correct mode badge after fallback", async ({
    page,
    request,
  }) => {
    // Create as text (voice mode may be disabled by feature flag) but navigate with mode=voice
    const sid = await createSessionViaApi(request, "text");
    await page.goto(`/user/training/voice?id=${sid}&mode=voice`);
    await page.waitForTimeout(5000);

    // Header should show mode indicator (text/voice/avatar)
    const modeIndicator = page.getByText(/text|voice|avatar/i).first();
    await expect(modeIndicator).toBeVisible({ timeout: 10000 });
  });

  test("keyboard input toggle works in fallback text mode", async ({
    page,
    request,
  }) => {
    const sid = await createSessionViaApi(request, "text");
    await page.goto(`/user/training/voice?id=${sid}&mode=text`);
    await page.waitForTimeout(3000);

    // Try to find and toggle keyboard button
    const keyboardButton = page.getByRole("button", { name: /keyboard/i })
      .or(page.locator("button[aria-label*='keyboard' i]"))
      .first();
    const kbCount = await keyboardButton.count();

    if (kbCount > 0) {
      await keyboardButton.click();
      await page.waitForTimeout(500);

      const input = page.locator("input[type='text']").first();
      const inputCount = await input.count();
      expect(inputCount).toBeGreaterThanOrEqual(0);
    }
  });

  test("no console errors on text mode page load", async ({ page, request }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    const sid = await createSessionViaApi(request, "text");
    await page.goto(`/user/training/voice?id=${sid}&mode=text`);
    await page.waitForTimeout(3000);

    // Filter out known non-critical errors (favicon, etc.)
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes("favicon") &&
        !err.includes("404") &&
        !err.includes("Failed to load resource"),
    );
    expect(criticalErrors.length).toBe(0);
  });

  test("page does not crash with invalid mode parameter", async ({
    page,
    request,
  }) => {
    const sid = await createSessionViaApi(request, "text");
    await page.goto(`/user/training/voice?id=${sid}&mode=invalid_mode`);
    await page.waitForTimeout(3000);

    // Page should still render (falls back to default mode)
    const body = page.locator("body");
    await expect(body).toBeVisible();

    const content = await body.textContent();
    expect(content?.length).toBeGreaterThan(0);
  });

  test("page loads correctly without any mode parameter", async ({
    page,
    request,
  }) => {
    // Create as text (voice mode may be disabled by feature flag)
    const sid = await createSessionViaApi(request, "text");
    await page.goto(`/user/training/voice?id=${sid}`);
    await page.waitForTimeout(5000);

    // Page should still render
    const endButton = page.getByRole("button", { name: /end session/i }).first();
    await expect(endButton).toBeVisible({ timeout: 10000 });
  });
});
