/**
 * Regression test: Admin page navigation must not cause forced logout.
 *
 * Bug: Navigating to admin pages (HCP profiles, scenarios, etc.) triggered
 * FastAPI's trailing-slash 307 redirect, which stripped the Authorization
 * header. The frontend's 401 interceptor then cleared auth and redirected
 * to /login.
 *
 * Fix: All backend routes use empty string registration (@router.get(""))
 * instead of trailing slash (@router.get("/")).
 */

import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Admin Navigation — No Auth Loss on Page Switch", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("navigating to HCP profiles does not redirect to login", async ({
    page,
  }) => {
    await page.goto("/admin/hcp-profiles");
    // Should stay on the HCP profiles page, NOT redirected to /login
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/admin\/hcp-profiles/);
  });

  test("navigating to scenarios does not redirect to login", async ({
    page,
  }) => {
    await page.goto("/admin/scenarios");
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/admin\/scenarios/);
  });

  test("navigating to scoring rubrics does not redirect to login", async ({
    page,
  }) => {
    await page.goto("/admin/scoring-rubrics");
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/admin\/scoring-rubrics/);
  });

  test("navigating to training materials does not redirect to login", async ({
    page,
  }) => {
    await page.goto("/admin/training-materials");
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/admin\/training-materials/);
  });

  test("navigating to users does not redirect to login", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/admin\/users/);
  });

  test("sequential admin page navigation preserves auth", async ({ page }) => {
    // Navigate through multiple admin pages in sequence
    // This simulates real user behavior clicking sidebar links

    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page).not.toHaveURL(/\/login/);

    // Click sidebar navigation to HCP profiles
    const hcpLink = page.getByRole("link", { name: /hcp|profiles/i });
    if ((await hcpLink.count()) > 0) {
      await hcpLink.first().click();
      await page.waitForTimeout(1500);
      await expect(page).not.toHaveURL(/\/login/);
    }

    // Click sidebar navigation to scenarios
    const scenarioLink = page.getByRole("link", { name: /scenario/i });
    if ((await scenarioLink.count()) > 0) {
      await scenarioLink.first().click();
      await page.waitForTimeout(1500);
      await expect(page).not.toHaveURL(/\/login/);
    }

    // Verify we're still authenticated by checking localStorage
    const token = await page.evaluate(() =>
      localStorage.getItem("access_token"),
    );
    expect(token).not.toBeNull();
  });
});

test.describe("User Navigation — No Auth Loss on Page Switch", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("navigating to training page does not redirect to login", async ({
    page,
  }) => {
    await page.goto("/user/training");
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("navigating to history does not redirect to login", async ({
    page,
  }) => {
    await page.goto("/user/history");
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("navigating to reports does not redirect to login", async ({
    page,
  }) => {
    await page.goto("/user/reports");
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
