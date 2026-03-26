import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Admin Settings Page", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/settings");
  });

  test("renders page with heading", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText(/System Settings/i);
  });

  test("shows Language & Region settings card", async ({ page }) => {
    await expect(page.getByText(/Language & Region/i)).toBeVisible();
    await expect(page.getByText(/Default Language/i)).toBeVisible();
  });

  test("shows Data Retention settings card", async ({ page }) => {
    await expect(page.getByText(/Data Retention/i)).toBeVisible();
    await expect(page.getByText(/Voice Recording Retention/i)).toBeVisible();
  });

  test("shows Branding settings card", async ({ page }) => {
    await expect(page.getByText(/Branding/i)).toBeVisible();
    await expect(page.getByText(/Organization Name/i)).toBeVisible();
    await expect(page.getByText(/Dark Mode/i)).toBeVisible();
  });

  test("form fields are present with default values", async ({ page }) => {
    // Organization name field should have BeiGene as default
    const orgNameInput = page.locator("input").filter({ hasText: "" }).nth(0);
    // Retention days input
    const retentionInput = page.locator('input[type="number"]');
    await expect(retentionInput).toBeVisible();
    await expect(retentionInput).toHaveValue("90");
  });

  test("save button exists", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Save Settings/i }),
    ).toBeVisible();
  });

  test("dark mode toggle is present", async ({ page }) => {
    // Switch component for dark mode
    const toggle = page.getByRole("switch");
    await expect(toggle).toBeVisible();
  });
});
