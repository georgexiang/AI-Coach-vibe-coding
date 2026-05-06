import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Admin System Enums management page.
 * Requires a running backend with seeded system_enums data.
 */

test.describe("Admin System Enums Page", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto("/login");
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/);

    // Navigate to system enums
    await page.goto("/admin/system-enums");
    await page.waitForLoadState("networkidle");
  });

  test("displays categories and enum values", async ({ page }) => {
    // Should see category buttons
    await expect(page.getByRole("button", { name: "product" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "specialty" }),
    ).toBeVisible();

    // Click product category
    await page.getByRole("button", { name: "product" }).click();

    // Should display seeded product values
    await expect(page.getByText("Tislelizumab")).toBeVisible();
    await expect(page.getByText("Zanubrutinib")).toBeVisible();
  });

  test("can add a new enum value", async ({ page }) => {
    // Select product category
    await page.getByRole("button", { name: "product" }).click();

    // Click Add Value
    await page.getByRole("button", { name: /Add Value/i }).click();

    // Fill in the form
    await page.fill('input[placeholder="e.g. oncology"]', "new_drug");
    await page.fill('input[placeholder="English label"]', "New Drug");
    await page.fill('input[placeholder="中文标签"]', "新药物");

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    // Verify the new value appears in the table
    await expect(page.getByText("New Drug")).toBeVisible();
  });

  test("can edit an enum value", async ({ page }) => {
    // Select specialty category
    await page.getByRole("button", { name: "specialty" }).click();
    await page.waitForLoadState("networkidle");

    // Click edit on the first item
    const editButtons = page.locator('button:has(svg.lucide-pencil)');
    await editButtons.first().click();

    // Modify the English label
    const labelInput = page.locator('input[placeholder="English label"]');
    await labelInput.clear();
    await labelInput.fill("Updated Specialty");

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    // Verify update appears
    await expect(page.getByText("Updated Specialty")).toBeVisible();
  });

  test("can delete an enum value with confirmation", async ({ page }) => {
    // Select difficulty category
    await page.getByRole("button", { name: "difficulty" }).click();
    await page.waitForLoadState("networkidle");

    // Count initial items
    const rows = page.locator("tbody tr");
    const initialCount = await rows.count();

    // Click delete on the last item
    const deleteButtons = page.locator('button:has(svg.lucide-trash-2)');
    await deleteButtons.last().click();

    // Confirm deletion
    await page
      .getByRole("button", { name: /delete/i })
      .last()
      .click();

    // Wait for removal
    await expect(rows).toHaveCount(initialCount - 1);
  });
});
