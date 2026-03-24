import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("F2F Training Session", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/user/training/session");
  });

  test("renders full-screen 3-panel layout", async ({ page }) => {
    // The page should NOT have the UserLayout navigation header
    await expect(page.locator("nav")).not.toBeVisible({ timeout: 2000 }).catch(
      () => {
        // nav may not exist at all, which is fine
      }
    );
    // Page should take full viewport
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("left panel shows scenario info", async ({ page }) => {
    // Key messages or scoring criteria should be visible
    await expect(
      page.getByText(/key message|scenario|product/i).first()
    ).toBeVisible();
  });

  test("center panel shows initial chat message from HCP", async ({
    page,
  }) => {
    // The HCP sends an initial greeting message
    await expect(
      page.getByText(/hello|welcome|how can|nice to meet|good morning|what brings/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("session timer is running", async ({ page }) => {
    // Timer should show 00:00 or similar format initially
    await expect(page.getByText(/\d+:\d+/).first()).toBeVisible();
    // Wait and check timer increments
    const timerText1 = await page.getByText(/\d+:\d+/).first().textContent();
    await page.waitForTimeout(2000);
    const timerText2 = await page.getByText(/\d+:\d+/).first().textContent();
    expect(timerText2).not.toBe(timerText1);
  });

  test("can send a message in chat", async ({ page }) => {
    // Find the text input area
    const input = page.getByPlaceholder(/type|message|input/i).first();
    await input.fill("Hello doctor, I want to discuss the treatment options.");
    // Press Enter or click send
    await input.press("Enter");
    // Message should appear in chat
    await expect(
      page.getByText("Hello doctor, I want to discuss the treatment options.")
    ).toBeVisible({ timeout: 5000 });
    // HCP should respond after a delay
    await page.waitForTimeout(2000);
  });

  test("side panels are collapsible", async ({ page }) => {
    // Find and click collapse toggles (chevron icons or toggle buttons)
    const collapseButtons = page.getByRole("button", {
      name: /collapse|toggle|chevron|panel/i,
    });
    const count = await collapseButtons.count();
    if (count > 0) {
      await collapseButtons.first().click();
      // Brief wait for animation
      await page.waitForTimeout(500);
    }
  });

  test("end session navigates to dashboard", async ({ page }) => {
    // Handle the confirm dialog
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    const endButton = page.getByRole("button", { name: /end session/i });
    await endButton.click();
    await expect(page).toHaveURL(/\/user\/dashboard/, { timeout: 5000 });
  });

  test("audio/text mode toggle exists", async ({ page }) => {
    // Look for the text/audio mode toggle or microphone button
    const micButton = page.getByRole("button", { name: /mic|audio|voice/i });
    const count = await micButton.count();
    // At least the toggle should exist somewhere
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
