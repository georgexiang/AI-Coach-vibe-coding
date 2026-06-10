/**
 * Cold Navigation Render Tests
 *
 * Verifies that ALL pages render without crash when navigated to directly
 * via URL (cold load). This catches bugs where form.watch(), useParams(),
 * or other hooks return undefined on initial render before state initializes.
 *
 * Pattern: page.goto() + assert no error boundary + assert no JS TypeError
 */
import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Cold Navigation — Admin Editor Pages (HIGH risk)", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  const editorRoutes = [
    { path: "/admin/hcp-profiles/new", name: "HCP Profile Create" },
    { path: "/admin/scenarios/new", name: "Scenario Create" },
    { path: "/admin/scoring-rubrics/new", name: "Rubric Create" },
    { path: "/admin/voice-live/new", name: "Voice Live Instance Create" },
    { path: "/admin/skills/new", name: "Skill Create" },
  ];

  for (const route of editorRoutes) {
    test(`${route.name} — direct navigation renders without crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      // Must not show React Router error boundary
      await expect(
        page.getByText("Unexpected Application Error"),
      ).not.toBeVisible();

      // Must not have unhandled JS errors (TypeError from .split/.join/.reduce on undefined)
      const typeErrors = errors.filter(
        (e) => e.includes("TypeError") || e.includes("Cannot read properties"),
      );
      expect(typeErrors).toHaveLength(0);

      // Page must render main content area (not blank)
      await expect(
        page.locator("main").first(),
      ).toBeVisible();

      // Form-specific: at least one input or button should be present
      const formElements = page.locator(
        'input, textarea, button[type="submit"], [role="combobox"]',
      );
      await expect(formElements.first()).toBeVisible({ timeout: 5000 });
    });
  }
});

test.describe("Cold Navigation — Admin List Pages", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  const listRoutes = [
    { path: "/admin/dashboard", name: "Admin Dashboard" },
    { path: "/admin/hcp-profiles", name: "HCP Profiles List" },
    { path: "/admin/scenarios", name: "Scenarios List" },
    { path: "/admin/scoring-rubrics", name: "Scoring Rubrics List" },
    { path: "/admin/voice-live", name: "Voice Live Management" },
    { path: "/admin/materials", name: "Training Materials" },
    { path: "/admin/skills", name: "Skill Hub" },
    { path: "/admin/users", name: "User Management" },
    { path: "/admin/azure-config", name: "Azure Config" },
    { path: "/admin/meta-skills", name: "Meta Skills" },
    { path: "/admin/settings", name: "Admin Settings" },
  ];

  for (const route of listRoutes) {
    test(`${route.name} — direct navigation renders without crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByText("Unexpected Application Error"),
      ).not.toBeVisible();

      const typeErrors = errors.filter(
        (e) => e.includes("TypeError") || e.includes("Cannot read properties"),
      );
      expect(typeErrors).toHaveLength(0);

      await expect(
        page.locator("main").first(),
      ).toBeVisible();
    });
  }
});

test.describe("Cold Navigation — User Pages", () => {
  test.use({ storageState: join(authDir, "user.json") });

  const userRoutes = [
    { path: "/user/dashboard", name: "User Dashboard" },
    { path: "/user/training", name: "Scenario Selection" },
    { path: "/user/history", name: "Session History" },
    { path: "/user/reports", name: "User Reports" },
  ];

  for (const route of userRoutes) {
    test(`${route.name} — direct navigation renders without crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByText("Unexpected Application Error"),
      ).not.toBeVisible();

      const typeErrors = errors.filter(
        (e) => e.includes("TypeError") || e.includes("Cannot read properties"),
      );
      expect(typeErrors).toHaveLength(0);

      await expect(
        page.locator("main").first(),
      ).toBeVisible();
    });
  }
});
