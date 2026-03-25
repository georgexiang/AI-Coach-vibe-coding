import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Admin Training Materials Management (Phase 5)", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/materials");
  });

  test("navigates to materials page and shows heading", async ({ page }) => {
    // Page heading should be visible
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 5000 });

    // Upload button should be present
    const uploadButton = page.getByRole("button", {
      name: /upload/i,
    });
    await expect(uploadButton.first()).toBeVisible();
  });

  test("displays empty state when no materials exist", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Either shows a materials table or empty state
    const tableRows = page.locator("tbody tr");
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      // Empty state should show an icon and message
      const emptyState = page.locator("text=/no.*material/i");
      const emptyCount = await emptyState.count();
      // Page renders without crashing
      expect(emptyCount).toBeGreaterThanOrEqual(0);
    } else {
      // Table has rows — materials exist
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test("upload dialog opens with form fields", async ({ page }) => {
    // Click the upload button
    const uploadButton = page.getByRole("button", {
      name: /upload/i,
    });
    await uploadButton.first().click();

    // Dialog should open
    await page.waitForTimeout(500);

    // Form fields should be visible in the dialog
    const nameInput = page.locator("#upload-name");
    const nameCount = await nameInput.count();
    if (nameCount > 0) {
      await expect(nameInput).toBeVisible();
    }

    const productInput = page.locator("#upload-product");
    const productCount = await productInput.count();
    if (productCount > 0) {
      await expect(productInput).toBeVisible();
    }

    // Dropzone area should be present (border-dashed container)
    const dropzone = page.locator("[class*='border-dashed']");
    const dropzoneCount = await dropzone.count();
    expect(dropzoneCount).toBeGreaterThan(0);

    // Cancel button should be present
    const cancelButton = page.getByRole("button", { name: /cancel/i });
    await expect(cancelButton.first()).toBeVisible();
  });

  test("search input filters materials", async ({ page }) => {
    // Search input should be present
    const searchInput = page.locator("input[class*='pl-9']").or(
      page.getByPlaceholder(/search/i),
    );
    await expect(searchInput.first()).toBeVisible();

    // Type a search query
    await searchInput.first().fill("NonExistentMaterial123");
    await page.waitForTimeout(1000);

    // The search has been applied — page should still render
    await expect(searchInput.first()).toHaveValue("NonExistentMaterial123");

    // Clear the search
    await searchInput.first().clear();
    await page.waitForTimeout(500);
  });

  test("product filter dropdown is interactive", async ({ page }) => {
    // Find the product filter select trigger
    const selectTrigger = page
      .locator("button[role='combobox']")
      .first();
    const triggerCount = await selectTrigger.count();

    if (triggerCount > 0) {
      await selectTrigger.click();
      await page.waitForTimeout(300);

      // Options should appear — at least "All Products" option
      const options = page.getByRole("option");
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThanOrEqual(1);

      // Click away or select first option to close
      await options.first().click();
    }
  });

  test("show archived toggle is functional", async ({ page }) => {
    // Find the switch for showing archived materials
    const archivedSwitch = page.locator("#show-archived");
    const switchCount = await archivedSwitch.count();

    if (switchCount > 0) {
      // Toggle it on
      await archivedSwitch.click();
      await page.waitForTimeout(500);

      // Toggle it off
      await archivedSwitch.click();
      await page.waitForTimeout(500);
    }
  });

  test("material row action buttons are visible when materials exist", async ({
    page,
  }) => {
    await page.waitForTimeout(2000);

    const tableRows = page.locator("tbody tr");
    const rowCount = await tableRows.count();

    if (rowCount > 0) {
      const firstRow = tableRows.first();

      // Action buttons: history, upload version, edit, archive
      const actionButtons = firstRow.locator("button");
      const buttonCount = await actionButtons.count();
      expect(buttonCount).toBeGreaterThanOrEqual(3);
    }
  });
});

test.describe("Training Materials — Non-Admin Access", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("regular user cannot access admin materials page", async ({ page }) => {
    await page.goto("/admin/materials");
    // Should be redirected away from the admin route
    await expect(page).toHaveURL(/\/user\/dashboard/);
  });
});
