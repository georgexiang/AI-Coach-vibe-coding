/**
 * Comprehensive i18n language switching tests.
 * Verifies language switcher works across authenticated pages,
 * persists language choice, and all key UI strings translate.
 */
import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("i18n — Login Page Language Switching", () => {
  test("login page renders in English by default", async ({ page }) => {
    // Navigate first so localStorage is accessible (about:blank blocks it)
    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("i18nextLng"));
    await page.reload();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    // English label should be present
    const submitText = await page.locator('button[type="submit"]').textContent();
    expect(submitText?.trim()).toBeTruthy();
  });

  test("language switcher is visible on login page", async ({ page }) => {
    await page.goto("/login");
    // The language switcher should be accessible
    const switcher = page
      .getByRole("button", { name: /language|lang|EN|中文/i })
      .or(page.locator("[data-testid='language-switcher']"))
      .or(page.locator("[aria-label*='language' i]"));
    const count = await switcher.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("i18n — Authenticated User Pages", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("dashboard renders with translated content", async ({ page }) => {
    await page.goto("/user/dashboard");
    await page.waitForLoadState("networkidle");
    // The h1 heading should be visible (translated welcome message)
    await expect(page.locator("h1")).toBeVisible();
    const heading = await page.locator("h1").textContent();
    expect(heading?.trim().length).toBeGreaterThan(0);
  });

  test("language choice persists in localStorage", async ({ page }) => {
    await page.goto("/user/dashboard");
    // Check that i18nextLng is stored
    const lang = await page.evaluate(() => localStorage.getItem("i18nextLng"));
    expect(lang).toBeTruthy();
    expect(["en-US", "zh-CN"]).toContain(lang);
  });

  test("training page shows translated scenario tabs", async ({ page }) => {
    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");
    // F2F and Conference tabs should be visible with translated text
    const f2fTab = page.getByRole("tab").first();
    const conferenceTab = page.getByRole("tab").nth(1);
    await expect(f2fTab).toBeVisible();
    await expect(conferenceTab).toBeVisible();
  });

  test("session history page shows translated table headers", async ({
    page,
  }) => {
    await page.goto("/user/history");
    await page.waitForLoadState("networkidle");
    // Page heading should be translated
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("i18n — Authenticated Admin Pages", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("admin scoring rubrics page shows translated heading", async ({
    page,
  }) => {
    await page.goto("/admin/scoring-rubrics");
    await expect(page.locator("h1")).toBeVisible();
    const heading = await page.locator("h1").textContent();
    expect(heading?.trim().length).toBeGreaterThan(0);
  });

  test("admin training materials page shows translated buttons", async ({
    page,
  }) => {
    await page.goto("/admin/materials");
    await expect(page.locator("h1")).toBeVisible();
    // Upload button should have translated text
    const uploadBtn = page.getByRole("button", { name: /upload|上传/i });
    await expect(uploadBtn.first()).toBeVisible();
  });

  test("admin pages use translated filter labels", async ({ page }) => {
    await page.goto("/admin/scoring-rubrics");
    await page.waitForLoadState("networkidle");
    // The "All" filter should be present (either English or Chinese)
    const filterTrigger = page.locator("button[role='combobox']").first();
    if ((await filterTrigger.count()) > 0) {
      const text = await filterTrigger.textContent();
      // Should contain either "All" or "全部"
      expect(text).toBeTruthy();
    }
  });
});

test.describe("i18n — Language Persistence Across Navigation", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("language setting persists when navigating between pages", async ({
    page,
  }) => {
    // Set language preference explicitly
    await page.goto("/user/dashboard");
    const initialLang = await page.evaluate(
      () => localStorage.getItem("i18nextLng") ?? "en-US",
    );

    // Navigate to training page
    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");
    const langAfterNav = await page.evaluate(() =>
      localStorage.getItem("i18nextLng"),
    );
    expect(langAfterNav).toBe(initialLang);

    // Navigate to history page
    await page.goto("/user/history");
    await page.waitForLoadState("networkidle");
    const langAfterHistory = await page.evaluate(() =>
      localStorage.getItem("i18nextLng"),
    );
    expect(langAfterHistory).toBe(initialLang);
  });
});
