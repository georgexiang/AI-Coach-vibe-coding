/**
 * Visual verification test for Voice + Digital Human Avatar.
 *
 * This test opens a REAL voice session with avatar, waits for the connection
 * to establish, takes screenshots at each stage, and pauses long enough
 * for visual inspection when run in --headed mode.
 *
 * Usage:
 *   npx playwright test e2e/voice-avatar-visual-check.spec.ts \
 *     --config=e2e/playwright.config.ts --headed
 *
 * Screenshots saved to: frontend/e2e/screenshots/
 */
import { test, expect } from "@playwright/test";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");
const screenshotDir = join(dirname(fileURLToPath(import.meta.url)), "screenshots");

// Ensure screenshot directory exists
mkdirSync(screenshotDir, { recursive: true });

test.describe("Visual Check: Voice + Digital Human Avatar", () => {
  test.use({ storageState: join(authDir, "user.json") });
  // Give plenty of time for real Azure connection + avatar WebRTC
  test.setTimeout(120000);

  test("full digital human session — visual verification with screenshots", async ({
    page,
    request,
  }) => {
    // ─── Step 1: Login and create session ─────────────────────────
    const loginResp = await request.post("/api/v1/auth/login", {
      data: { username: "user1", password: "user123" },
    });
    const { access_token } = await loginResp.json();

    // Check voice live + avatar availability
    const statusResp = await request.get("/api/v1/voice-live/status", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const status = await statusResp.json();
    console.log("[Visual Check] Voice Live available:", status.voice_live_available);
    console.log("[Visual Check] Avatar available:", status.avatar_available);

    if (!status.voice_live_available) {
      console.log("[Visual Check] SKIP: Voice Live not configured");
      test.skip();
      return;
    }

    // Create a session
    const scenariosResp = await request.get("/api/v1/scenarios/active", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const scenarios = await scenariosResp.json();
    const scenarioId = scenarios[0].id;

    const sessionResp = await request.post("/api/v1/sessions", {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { scenario_id: scenarioId, mode: "text" },
    });
    const session = await sessionResp.json();
    const sessionId = session.id;
    console.log("[Visual Check] Session created:", sessionId);

    // ─── Step 2: Track SDK connection events ──────────────────────
    const sdkLogs: string[] = [];
    const errors: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("[VoiceLive]") || text.includes("avatar") || text.includes("ICE") || text.includes("SDP")) {
        sdkLogs.push(`[${msg.type()}] ${text}`);
        console.log(`  SDK: ${text}`);
      }
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
      console.log(`  PAGE ERROR: ${err.message}`);
    });

    // ─── Step 3: Navigate to voice session ────────────────────────
    console.log("[Visual Check] Opening voice session page...");
    await page.goto(`/user/training/voice?id=${sessionId}&mode=voice`);

    // Screenshot: initial page load
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: join(screenshotDir, "01-page-loaded.png"),
      fullPage: true,
    });
    console.log("[Visual Check] Screenshot: 01-page-loaded.png");

    // ─── Step 4: Wait for voice connection ────────────────────────
    console.log("[Visual Check] Waiting for Voice Live SDK connection (15s)...");
    await page.waitForTimeout(15000);

    await page.screenshot({
      path: join(screenshotDir, "02-voice-connecting.png"),
      fullPage: true,
    });
    console.log("[Visual Check] Screenshot: 02-voice-connecting.png");

    // ─── Step 5: Wait for avatar WebRTC connection ────────────────
    console.log("[Visual Check] Waiting for Avatar WebRTC connection (15s)...");
    await page.waitForTimeout(15000);

    // Check for video element (created by ontrack handler)
    const videoElements = await page.locator("video").count();
    console.log(`[Visual Check] Video elements found: ${videoElements}`);

    // Check for avatar video specifically
    const avatarVideo = page.locator("video#video, video[autoplay]").first();
    const hasAvatarVideo = (await avatarVideo.count()) > 0;
    console.log(`[Visual Check] Avatar video element present: ${hasAvatarVideo}`);

    if (hasAvatarVideo) {
      // Check if video is actually playing (has dimensions)
      const videoBox = await avatarVideo.boundingBox();
      console.log(`[Visual Check] Video dimensions: ${JSON.stringify(videoBox)}`);
    }

    await page.screenshot({
      path: join(screenshotDir, "03-avatar-connected.png"),
      fullPage: true,
    });
    console.log("[Visual Check] Screenshot: 03-avatar-connected.png");

    // ─── Step 6: Extended wait to see avatar animation ────────────
    console.log("[Visual Check] Extended wait for avatar rendering (15s)...");
    await page.waitForTimeout(15000);

    await page.screenshot({
      path: join(screenshotDir, "04-avatar-animated.png"),
      fullPage: true,
    });
    console.log("[Visual Check] Screenshot: 04-avatar-animated.png");

    // ─── Step 7: Check final state ────────────────────────────────
    // End session button should be visible
    const endButton = page.getByRole("button", { name: /end session/i }).first();
    await expect(endButton).toBeVisible({ timeout: 5000 });

    // Print summary
    console.log("\n[Visual Check] ═══ SUMMARY ═══");
    console.log(`  SDK logs captured: ${sdkLogs.length}`);
    console.log(`  Page errors: ${errors.length}`);
    console.log(`  Video elements: ${videoElements}`);
    console.log(`  Avatar video present: ${hasAvatarVideo}`);
    console.log("  SDK log details:");
    for (const log of sdkLogs) {
      console.log(`    ${log}`);
    }
    if (errors.length > 0) {
      console.log("  Errors:");
      for (const err of errors) {
        console.log(`    ${err}`);
      }
    }
    console.log("[Visual Check] Screenshots saved to: e2e/screenshots/");
    console.log("[Visual Check] ═══════════════════\n");

    // ─── Step 8: End session cleanly ──────────────────────────────
    await endButton.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
    const confirmBtn = dialog.getByRole("button", { name: /end/i }).first();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
  });
});
