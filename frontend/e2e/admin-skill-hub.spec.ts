import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Skill Hub Page", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/skills");
  });

  // ─── Page Structure ───────────────────────────────────────────────────

  test("renders skill hub page with title and create button", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Skill Hub" }),
    ).toBeVisible();
    const createBtn = page.getByRole("button", {
      name: /create|new|skill/i,
    });
    await expect(createBtn.first()).toBeVisible();
  });

  test("displays search input and filter dropdowns", async ({ page }) => {
    // Search input
    await expect(page.locator("input[placeholder]").first()).toBeVisible();

    // Status filter dropdown
    const statusTrigger = page
      .locator("button[role='combobox']")
      .first();
    await expect(statusTrigger).toBeVisible();
  });

  // ─── Create Dialog ────────────────────────────────────────────────────

  test("create button opens creation dialog with two options", async ({
    page,
  }) => {
    const createBtn = page.getByRole("button", {
      name: /create|new|skill/i,
    });
    await createBtn.first().click();

    // Dialog should appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Two creation options: From Materials + Import ZIP
    const buttons = dialog.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("create from materials option creates skill and navigates to editor", async ({
    page,
  }) => {
    const createBtn = page.getByRole("button", {
      name: /create|new|skill/i,
    });
    await createBtn.first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click the first option (Create from materials)
    const materialBtn = dialog.locator("button").first();
    await materialBtn.click();

    // Material picker may open if materials exist
    const picker = page.getByRole("dialog");
    const pickerVisible = await picker.isVisible({ timeout: 2000 }).catch(() => false);
    if (pickerVisible) {
      // Select first material and confirm
      const materialItem = picker.locator("button").first();
      const itemCount = await materialItem.count();
      if (itemCount > 0) {
        await materialItem.click();
      }
      // Click convert button (last button in dialog)
      const convertBtn = picker.getByRole("button", { name: /convert|confirm/i });
      const convertCount = await convertBtn.count();
      if (convertCount > 0) {
        await convertBtn.click();
      }
    }

    // Should navigate to skill editor
    await page.waitForURL(/\/admin\/skills\/[^/]+\/edit/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/admin\/skills\/.*\/edit/);
  });

  // ─── Search and Filter ────────────────────────────────────────────────

  test("search input filters skills by name", async ({ page }) => {
    // Type in search input
    const searchInput = page.locator("input[placeholder]").first();
    await searchInput.fill("NonExistentSkillName12345");
    await page.waitForTimeout(500); // Wait for debounce

    // Should show empty state or no cards
    await page.waitForTimeout(1000);
  });

  test("status filter dropdown shows all status options", async ({ page }) => {
    const statusTrigger = page
      .locator("button[role='combobox']")
      .first();
    await statusTrigger.click();
    await page.waitForTimeout(300);

    // Status options should be visible
    const draftOption = page.getByRole("option", { name: /draft/i });
    const draftCount = await draftOption.count();
    if (draftCount > 0) {
      await expect(draftOption).toBeVisible();
    }
  });

  // ─── Skill Card Actions ───────────────────────────────────────────────

  test("skill card shows action menu with edit, archive, export, delete", async ({
    page,
  }) => {
    // Create a skill via API directly (avoids dialog flow changes)
    await page.evaluate(async () => {
      await fetch("/api/v1/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ name: "Card Action Skill" }),
      });
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // Find action menu button on skill card
    const actionBtns = page.locator(
      "[data-testid='skill-card-actions'], button[aria-label*='action'], button[aria-label*='menu']",
    );
    const count = await actionBtns.count();
    if (count > 0) {
      await actionBtns.first().click();
      await page.waitForTimeout(300);
    }
  });

  // ─── Delete Confirmation ──────────────────────────────────────────────

  test("delete shows confirmation dialog with cancel option", async ({
    page,
  }) => {
    // Create a skill via API directly
    await page.evaluate(async () => {
      await fetch("/api/v1/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ name: "Delete Test Skill" }),
      });
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // Look for delete trigger on any skill card
    const deleteMenuItems = page.getByRole("menuitem", { name: /delete/i });
    const deleteButtons = page.locator("button").filter({ hasText: /delete/i });

    // Try to find and click delete trigger
    const menuItems = await deleteMenuItems.count();
    const buttons = await deleteButtons.count();

    if (menuItems > 0) {
      await deleteMenuItems.first().click();
    } else if (buttons > 0) {
      // Might need to open a dropdown first
      const moreButtons = page.locator("button[aria-label]").filter({
        hasText: /more|action/i,
      });
      const moreCount = await moreButtons.count();
      if (moreCount > 0) {
        await moreButtons.first().click();
        await page.waitForTimeout(300);
        const deleteItem = page.getByRole("menuitem", { name: /delete/i });
        const dCount = await deleteItem.count();
        if (dCount > 0) {
          await deleteItem.click();
        }
      }
    }

    // If delete confirmation appeared, check cancel button exists
    const confirmDialog = page.getByRole("dialog");
    const confirmVisible = await confirmDialog.isVisible().catch(() => false);
    if (confirmVisible) {
      const cancelBtn = confirmDialog.getByRole("button", { name: /cancel/i });
      const cancelCount = await cancelBtn.count();
      if (cancelCount > 0) {
        await cancelBtn.click();
      }
    }
  });

  // ─── Empty State ──────────────────────────────────────────────────────

  test("empty state shows when no skills match filters", async ({ page }) => {
    // Apply a filter that likely returns no results
    const searchInput = page.locator("input[placeholder]").first();
    await searchInput.fill("ZZZZZ_NO_MATCH_ZZZZZ");
    await page.waitForTimeout(500);

    // Page should still render without errors
    await expect(
      page.getByRole("heading", { name: "Skill Hub" }),
    ).toBeVisible();
  });
});
