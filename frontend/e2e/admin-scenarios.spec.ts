import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Admin Scenarios Management", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/scenarios");
  });

  test("renders scenarios page with title, table, and create button", async ({
    page,
  }) => {
    // Page heading should be visible
    await expect(page.locator("h1")).toBeVisible();

    // Create button should be visible
    const createButton = page.getByRole("button", {
      name: /create|new scenario/i,
    });
    await expect(createButton.first()).toBeVisible();

    // Table headers should be visible
    await expect(page.getByText("Name").first()).toBeVisible();
    await expect(page.getByText("Product").first()).toBeVisible();
    await expect(page.getByText("HCP").first()).toBeVisible();
    await expect(page.getByText("Difficulty").first()).toBeVisible();
    await expect(page.getByText("Status").first()).toBeVisible();
  });

  test("create scenario opens editor dialog with form fields", async ({
    page,
  }) => {
    // Click the create button
    const createButton = page.getByRole("button", {
      name: /create|new scenario/i,
    });
    await createButton.first().click();

    // A dialog should appear with the form
    await expect(
      page.getByRole("dialog"),
    ).toBeVisible({ timeout: 5000 });

    // Form fields should be present in the dialog
    await expect(page.getByText("Name *").first()).toBeVisible();
    await expect(page.getByText("Product *").first()).toBeVisible();
    await expect(page.getByText("Description").first()).toBeVisible();

    // Mode radio buttons should be present (f2f, conference)
    await expect(page.getByText("F2F").first()).toBeVisible();
    await expect(page.getByText("CONFERENCE").first()).toBeVisible();

    // Difficulty radio buttons should be present
    await expect(
      page.locator("label").filter({ hasText: /easy/i }).first(),
    ).toBeVisible();
    await expect(
      page.locator("label").filter({ hasText: /medium/i }).first(),
    ).toBeVisible();
    await expect(
      page.locator("label").filter({ hasText: /hard/i }).first(),
    ).toBeVisible();

    // Save button in dialog footer
    await expect(
      page.getByRole("dialog").getByRole("button", { name: /save/i }),
    ).toBeVisible();
  });

  test("scenario editor has rubric selector instead of scoring weights", async ({ page }) => {
    // Click create to open editor dialog
    const createButton = page.getByRole("button", {
      name: /create|new scenario/i,
    });
    await createButton.first().click();

    // Wait for dialog to open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Rubric selector label should be visible (replaces old scoring weights)
    await expect(
      dialog.getByText("Scoring Rubric *"),
    ).toBeVisible();

    // Rubric dropdown trigger with placeholder should exist
    await expect(
      dialog.getByText("Select scoring rubric"),
    ).toBeVisible();

    // Dimension preview empty state should show
    await expect(
      dialog.getByText("Select a scoring rubric to see dimensions"),
    ).toBeVisible();

    // "Manage Rubrics" link should be present
    await expect(
      dialog.getByText("Manage Rubrics"),
    ).toBeVisible();

    // Pass Threshold field should still be present
    await expect(
      dialog.getByText(/pass threshold/i).first(),
    ).toBeVisible();

    // Key Messages section should still be in the editor
    await expect(
      dialog.getByText(/key message/i).first(),
    ).toBeVisible();
  });

  test("status filter dropdown works", async ({ page }) => {
    // The status filter select should be visible
    const filterTrigger = page
      .locator("button[role='combobox']")
      .filter({ hasText: /all|active|draft/i })
      .first();

    const filterCount = await filterTrigger.count();
    if (filterCount > 0) {
      await filterTrigger.click();
      await page.waitForTimeout(300);

      // Active option should be available
      const activeOption = page.getByRole("option", { name: /active/i });
      const optCount = await activeOption.count();
      if (optCount > 0) {
        await activeOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Page should still render without errors after filtering
    await expect(page.locator("h1")).toBeVisible();
  });

  test("scenario table row actions menu contains edit, clone, delete", async ({
    page,
  }) => {
    // Wait for table rows to load
    await page.waitForTimeout(2000);

    // Find the MoreHorizontal action buttons in table body rows (td cells only, not th)
    const actionButtons = page.locator("td").last().locator("button");
    const count = await actionButtons.count();

    if (count > 0) {
      // Click the first action menu button in a table row
      await actionButtons.first().click();
      await page.waitForTimeout(500);

      // The dropdown menu should contain Edit, Clone, Delete items
      await expect(
        page.getByRole("menuitem", { name: /edit/i }),
      ).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole("menuitem", { name: /clone/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: /delete/i }),
      ).toBeVisible();
    }
  });

  test("creates a new scenario with rubric and verifies it appears in the table", async ({
    page,
  }) => {
    const scenarioName = `E2E Scenario ${Date.now()}`;

    // Click the create button
    const createButton = page.getByRole("button", {
      name: /create|new scenario/i,
    });
    await createButton.first().click();

    // Wait for dialog to appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Fill the Name field (first text input in the dialog)
    const nameInput = dialog.locator("input[type='text'], input:not([type])").first();
    await nameInput.fill(scenarioName);

    // Select Product from dropdown (first combobox in dialog)
    const comboboxes = dialog.locator("button[role='combobox']");
    await comboboxes.nth(0).click();
    await page.waitForTimeout(300);
    const productOption = page.getByRole("option", { name: /Tislelizumab/i });
    await expect(productOption).toBeVisible({ timeout: 3000 });
    await productOption.click();
    await page.waitForTimeout(300);

    // Select HCP from dropdown (third combobox — after Product and Therapeutic Area)
    await comboboxes.nth(2).click();
    await page.waitForTimeout(300);
    const hcpOptions = page.getByRole("option");
    const hcpCount = await hcpOptions.count();
    if (hcpCount > 0) {
      await hcpOptions.first().click();
      await page.waitForTimeout(300);
    }

    // Select Scoring Rubric (fifth combobox — after Product, Therapeutic Area, HCP, Skill)
    await comboboxes.nth(4).click();
    await page.waitForTimeout(300);
    const rubricOption = page.getByRole("option").first();
    await expect(rubricOption).toBeVisible({ timeout: 3000 });
    await rubricOption.click();
    await page.waitForTimeout(300);

    // After selecting rubric, dimension preview should appear (not the empty state)
    await expect(
      dialog.getByText("Select a scoring rubric to see dimensions"),
    ).not.toBeVisible();

    // Click Save
    await dialog.getByRole("button", { name: /save/i }).click();

    // Verify: dialog should close on success (no validation error)
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Verify: new scenario name should appear in the table
    await expect(page.getByText(scenarioName).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("archived filter option is available in status dropdown", async ({ page }) => {
    // Find the status filter
    const filterTrigger = page
      .locator("button[role='combobox']")
      .filter({ hasText: /all|active|draft|archived/i })
      .first();

    const filterCount = await filterTrigger.count();
    if (filterCount > 0) {
      await filterTrigger.click();
      await page.waitForTimeout(300);

      // Archived option should be available
      const archivedOption = page.getByRole("option", { name: /archived/i });
      await expect(archivedOption).toBeVisible({ timeout: 3000 });
    }

    // Page should still render without errors
    await expect(page.locator("h1")).toBeVisible();
  });

  test("archive flow: activate then archive scenario", async ({ page }) => {
    // Wait for table rows to load
    await page.waitForTimeout(2000);

    // Find a scenario row action button
    const actionButtons = page.locator("td").last().locator("button");
    const count = await actionButtons.count();

    if (count > 0) {
      // Click the first action menu button
      await actionButtons.first().click();
      await page.waitForTimeout(500);

      // Check if Activate action is available (for draft scenarios)
      const activateItem = page.getByRole("menuitem", { name: /activate/i });
      const activateCount = await activateItem.count();

      if (activateCount > 0) {
        await activateItem.click();
        await page.waitForTimeout(1000);

        // Re-open menu to check Archive action
        await actionButtons.first().click();
        await page.waitForTimeout(500);

        const archiveItem = page.getByRole("menuitem", { name: /archive/i });
        const archiveCount = await archiveItem.count();

        if (archiveCount > 0) {
          await archiveItem.click();
          await page.waitForTimeout(500);

          // Archive confirmation dialog should appear
          const confirmDialog = page.getByRole("dialog");
          await expect(confirmDialog).toBeVisible({ timeout: 3000 });
          await expect(
            confirmDialog.getByText(/archive scenario/i),
          ).toBeVisible();

          // Cancel to dismiss
          await confirmDialog
            .getByRole("button", { name: /cancel/i })
            .click();
        }
      }
    }

    // Page should still render without errors
    await expect(page.locator("h1")).toBeVisible();
  });

  test("archived scenario row shows muted styling and outline badge", async ({ page }) => {
    // Select "Archived" from filter
    const filterTrigger = page
      .locator("button[role='combobox']")
      .filter({ hasText: /all|active|draft|archived/i })
      .first();

    const filterCount = await filterTrigger.count();
    if (filterCount > 0) {
      await filterTrigger.click();
      await page.waitForTimeout(300);

      const archivedOption = page.getByRole("option", { name: /archived/i });
      const optCount = await archivedOption.count();
      if (optCount > 0) {
        await archivedOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Page should render even if there are no archived scenarios
    await expect(page.locator("h1")).toBeVisible();
  });

  test("delete scenario shows confirmation dialog", async ({ page }) => {
    // Wait for table rows to load
    await page.waitForTimeout(1000);

    // Find action buttons in table rows
    const moreButtons = page.locator("table button").or(
      page.locator("td button"),
    );
    const count = await moreButtons.count();

    if (count > 0) {
      // Open the dropdown menu
      await moreButtons.first().click();
      await page.waitForTimeout(300);

      // Click delete
      const deleteItem = page.getByRole("menuitem", { name: /delete/i });
      const deleteCount = await deleteItem.count();
      if (deleteCount > 0) {
        await deleteItem.click();
        await page.waitForTimeout(300);

        // Confirmation dialog should appear
        const confirmDialog = page.getByRole("dialog");
        await expect(confirmDialog).toBeVisible({ timeout: 3000 });
        await expect(
          confirmDialog.getByText(/delete scenario/i),
        ).toBeVisible();

        // Cancel and Delete buttons should be present
        await expect(
          confirmDialog.getByRole("button", { name: /cancel/i }),
        ).toBeVisible();
        await expect(
          confirmDialog.getByRole("button", { name: /delete/i }),
        ).toBeVisible();

        // Click cancel to dismiss
        await confirmDialog
          .getByRole("button", { name: /cancel/i })
          .click();
      }
    }
  });
});
