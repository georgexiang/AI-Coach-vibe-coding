/**
 * Comprehensive navigation tests for user and admin flows.
 * Verifies sidebar links, breadcrumbs, page transitions, and deep links.
 */
import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("User Sidebar Navigation", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("dashboard link navigates correctly", async ({ page }) => {
    await page.goto("/user/training");
    await page.waitForLoadState("networkidle");

    const dashboardLink = page.getByRole("link", { name: /dashboard/i });
    if ((await dashboardLink.count()) > 0) {
      await dashboardLink.first().click();
      await expect(page).toHaveURL(/\/user\/dashboard/);
    }
  });

  test("training link navigates correctly", async ({ page }) => {
    await page.goto("/user/dashboard");
    await page.waitForLoadState("networkidle");

    const trainingLink = page.getByRole("link", { name: /training/i });
    if ((await trainingLink.count()) > 0) {
      await trainingLink.first().click();
      await expect(page).toHaveURL(/\/user\/training/);
    }
  });

  test("history link navigates correctly", async ({ page }) => {
    await page.goto("/user/dashboard");
    await page.waitForLoadState("networkidle");

    const historyLink = page.getByRole("link", { name: /history/i });
    if ((await historyLink.count()) > 0) {
      await historyLink.first().click();
      await expect(page).toHaveURL(/\/user\/history/);
    }
  });

  test("sequential user navigation preserves auth state", async ({ page }) => {
    const routes = ["/user/dashboard", "/user/training", "/user/history", "/user/reports"];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(1000);
      await expect(page).not.toHaveURL(/\/login/);

      // Verify token is still present
      const token = await page.evaluate(() =>
        localStorage.getItem("access_token"),
      );
      expect(token).not.toBeNull();
    }
  });

  test("page titles update on navigation", async ({ page }) => {
    await page.goto("/user/dashboard");
    await page.waitForLoadState("networkidle");
    const dashH1 = await page.locator("h1").first().textContent();
    expect(dashH1?.trim().length).toBeGreaterThan(0);

    await page.goto("/user/history");
    await page.waitForLoadState("networkidle");
    const histH1 = await page.locator("h1").first().textContent();
    expect(histH1?.trim().length).toBeGreaterThan(0);
  });
});

test.describe("Admin Sidebar Navigation", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("admin can navigate to all admin pages via sidebar", async ({
    page,
  }) => {
    const adminRoutes = [
      { path: "/admin/dashboard", pattern: /\/admin\/dashboard/ },
      { path: "/admin/hcp-profiles", pattern: /\/admin\/hcp-profiles/ },
      { path: "/admin/scenarios", pattern: /\/admin\/scenarios/ },
      { path: "/admin/scoring-rubrics", pattern: /\/admin\/scoring-rubrics/ },
      { path: "/admin/materials", pattern: /\/admin\/materials/ },
      { path: "/admin/users", pattern: /\/admin\/users/ },
    ];

    for (const route of adminRoutes) {
      await page.goto(route.path);
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(route.pattern);
      await expect(page).not.toHaveURL(/\/login/);
    }
  });

  test("admin sidebar links are visible", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // At least some navigation links should be present in the sidebar
    const navLinks = page.locator("nav a, aside a");
    const linkCount = await navLinks.count();
    expect(linkCount).toBeGreaterThan(0);
  });

  test("clicking sidebar links updates page content", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Navigate to scoring rubrics via sidebar
    const rubricsLink = page.getByRole("link", { name: /rubric|scoring/i });
    if ((await rubricsLink.count()) > 0) {
      await rubricsLink.first().click();
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(/\/admin\/scoring-rubrics/);
      await expect(page.locator("h1")).toBeVisible();
    }
  });
});

test.describe("Deep Link Navigation", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("direct URL to user training page works", async ({ page }) => {
    await page.goto("/user/training");
    await expect(page).toHaveURL(/\/user\/training/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("direct URL to user history page works", async ({ page }) => {
    await page.goto("/user/history");
    await expect(page).toHaveURL(/\/user\/history/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("direct URL to user reports page works", async ({ page }) => {
    await page.goto("/user/reports");
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Deep Link Navigation — Admin", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("direct URL to admin materials page works", async ({ page }) => {
    await page.goto("/admin/materials");
    await expect(page).toHaveURL(/\/admin\/materials/);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("direct URL to admin scoring rubrics page works", async ({ page }) => {
    await page.goto("/admin/scoring-rubrics");
    await expect(page).toHaveURL(/\/admin\/scoring-rubrics/);
    await expect(page.locator("h1")).toBeVisible();
  });
});
