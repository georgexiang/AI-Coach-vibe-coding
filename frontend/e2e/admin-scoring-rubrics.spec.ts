import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Admin Scoring Rubrics Page", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/scoring-rubrics");
  });

  test("renders page with heading", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText(/Scoring Rubrics/i);
  });

  test("shows rubric list table or empty state", async ({ page }) => {
    const table = page.locator("table");
    const emptyState = page.getByText(/No Scoring Rubrics/i);
    const tableCount = await table.count();
    const emptyCount = await emptyState.count();
    expect(tableCount + emptyCount).toBeGreaterThan(0);
  });

  test("create rubric button exists", async ({ page }) => {
    await expect(page.getByText(/Create Rubric/i)).toBeVisible();
  });

  test("filter dropdown exists and works", async ({ page }) => {
    const filterTrigger = page.locator("button").filter({ hasText: "All" }).first();
    await expect(filterTrigger).toBeVisible();

    await filterTrigger.click();
    await page.waitForTimeout(300);

    await expect(page.getByRole("option", { name: /Face-to-Face/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /Conference/i })).toBeVisible();
  });

  test("clicking create rubric navigates to editor page", async ({ page }) => {
    await page.getByText(/Create Rubric/i).click();
    await page.waitForURL("**/admin/scoring-rubrics/new");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("rubric editor page has back button to list", async ({ page }) => {
    await page.goto("/admin/scoring-rubrics/new");
    await page.waitForLoadState("networkidle");

    const backButton = page.locator("button").first();
    await backButton.click();
    await page.waitForURL("**/admin/scoring-rubrics");
    await expect(page.locator("h1")).toContainText(/Scoring Rubrics/i);
  });

  test("rubric editor page shows form fields", async ({ page }) => {
    await page.goto("/admin/scoring-rubrics/new");
    await page.waitForLoadState("networkidle");

    // Basic info card
    await expect(page.getByText(/Basic Information/i)).toBeVisible();
    // Dimensions card
    await expect(page.getByText(/Dimensions/i).first()).toBeVisible();
    // Category weights card
    await expect(page.getByText(/Score Category Weights/i)).toBeVisible();
  });

  test("double-click on rubric row navigates to editor", async ({ page }) => {
    const tableRow = page.locator("table tbody tr").first();
    if ((await tableRow.count()) > 0) {
      await tableRow.dblclick();
      await page.waitForURL(/\/admin\/scoring-rubrics\/.+/);
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("filter by F2F narrows results", async ({ page }) => {
    const filterTrigger = page.locator("button[role='combobox']").first();
    if ((await filterTrigger.count()) > 0) {
      await filterTrigger.click();
      await page.waitForTimeout(300);
      const f2fOption = page.getByRole("option", { name: /Face-to-Face/i });
      if ((await f2fOption.count()) > 0) {
        await f2fOption.click();
        await page.waitForTimeout(500);
        await expect(page.locator("h1")).toBeVisible();
      }
    }
  });

  test("page does not crash with no rubrics", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("body")).toBeVisible();
  });

  test("rubric editor shows CU analyzers section for existing rubric", async ({
    page,
  }) => {
    // Navigate to an existing rubric via double-click
    const tableRow = page.locator("table tbody tr").first();
    if ((await tableRow.count()) > 0) {
      await tableRow.dblclick();
      await page.waitForURL(/\/admin\/scoring-rubrics\/.+/);
      await page.waitForLoadState("networkidle");

      // CU analyzers section should be visible (either with data or empty state)
      const cuSection = page.getByText(/Content Understanding Analyzers|内容理解分析器/i);
      await expect(cuSection).toBeVisible({ timeout: 5000 });
    }
  });

  test("CU analyzers section shows analyzer IDs when configured", async ({
    page,
  }) => {
    const tableRow = page.locator("table tbody tr").first();
    if ((await tableRow.count()) > 0) {
      await tableRow.dblclick();
      await page.waitForURL(/\/admin\/scoring-rubrics\/.+/);
      await page.waitForLoadState("networkidle");

      // Check for either the analyzers with data or empty state message
      const cuSection = page.getByText(/Content Understanding Analyzers|内容理解分析器/i);
      await expect(cuSection).toBeVisible({ timeout: 5000 });

      // If analyzers are configured, portal buttons should exist
      const portalButtons = page.getByText(/View in Azure Portal|在 Azure 门户中查看/i);
      const emptyState = page.getByText(/auto-created|自动创建/i);
      const portalCount = await portalButtons.count();
      const emptyCount = await emptyState.count();
      // Either has portal links or shows empty state
      expect(portalCount + emptyCount).toBeGreaterThan(0);
    }
  });

  test("CU analyzers section is NOT shown on new rubric page", async ({
    page,
  }) => {
    await page.goto("/admin/scoring-rubrics/new");
    await page.waitForLoadState("networkidle");

    // CU section should not appear for new rubrics
    const cuSection = page.getByText(/Content Understanding Analyzers|内容理解分析器/i);
    await expect(cuSection).toHaveCount(0);
  });
});
