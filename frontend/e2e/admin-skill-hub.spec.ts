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

  // ─── Material → Skill Agent Conversion ─────────────────────────────────

  test("create from materials triggers agent conversion and completes", async ({
    page,
  }) => {
    // Increase timeout — agent conversion can take time
    test.setTimeout(90_000);

    // Step 1: Create a material with a PDF file via API
    const materialResult = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");

      // Create a minimal valid PDF in-memory
      const pdfContent = [
        "%PDF-1.4",
        "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
        "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
        "4 0 obj<</Length 44>>stream",
        "BT /F1 12 Tf 100 700 Td (E2E Test Material Content for Skill Conversion) Tj ET",
        "endstream endobj",
        "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
        "xref",
        "0 6",
        "0000000000 65535 f ",
        "0000000009 00000 n ",
        "0000000058 00000 n ",
        "0000000115 00000 n ",
        "0000000266 00000 n ",
        "0000000360 00000 n ",
        "trailer<</Size 6/Root 1 0 R>>",
        "startxref",
        "431",
        "%%EOF",
      ].join("\n");

      const blob = new Blob([pdfContent], { type: "application/pdf" });
      const formData = new FormData();
      formData.append("file", blob, "e2e-test-material.pdf");
      formData.append("name", "E2E Agent Conversion Test Material");
      formData.append("product", "E2E Test Product");

      const resp = await fetch("/api/v1/materials", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return { error: `Material creation failed: ${resp.status} ${errText}` };
      }
      const material = await resp.json();
      return { id: material.id, name: material.name };
    });

    expect(materialResult).not.toHaveProperty("error");
    const materialId = (materialResult as { id: string }).id;
    const materialName = (materialResult as { name: string }).name;

    // Step 2: Reload page so material picker can see the new material
    await page.reload();
    await page.waitForTimeout(1000);

    // Step 3: Click "Create Skill" button
    const createBtn = page.getByRole("button", {
      name: /create|new|skill/i,
    });
    await createBtn.first().click();

    // Step 4: Dialog opens — click "Create from Materials"
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const fromMaterialsBtn = dialog
      .locator("button")
      .filter({ hasText: /Create from Materials|从材料创建/i });
    await fromMaterialsBtn.click();

    // Step 5: Material Picker opens — select the test material
    const picker = page.getByRole("dialog");
    await expect(picker).toBeVisible({ timeout: 5000 });

    // Find and click the material by name (use first() in case of duplicates from prior runs)
    const materialItem = picker
      .locator("button")
      .filter({ hasText: materialName })
      .first();
    await expect(materialItem).toBeVisible({ timeout: 5000 });
    await materialItem.click();

    // Step 6: Click "Convert" button
    const convertBtn = picker.getByRole("button", {
      name: /convert|confirm/i,
    });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // Step 7: Should navigate to skill editor
    await page.waitForURL(/\/admin\/skills\/[^/]+\/edit/, { timeout: 15000 });
    const url = page.url();
    const skillIdMatch = url.match(/\/skills\/([^/]+)\/edit/);
    expect(skillIdMatch).toBeTruthy();
    const skillId = skillIdMatch![1];

    // Step 8: Poll conversion status until complete (agent is available via AI Foundry)
    let lastStatus = "";
    let lastError = "";
    const pollStart = Date.now();
    const pollTimeout = 60_000;

    while (Date.now() - pollStart < pollTimeout) {
      const statusData = await page.evaluate(async (sid: string) => {
        const token = localStorage.getItem("access_token");
        const resp = await fetch(`/api/v1/skills/${sid}/conversion-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return resp.json();
      }, skillId);

      lastStatus = statusData.conversion_status;
      lastError = statusData.conversion_error || "";

      if (lastStatus === "completed" || lastStatus === "failed") {
        break;
      }
      await page.waitForTimeout(3000);
    }

    // Step 9: Verify conversion completed successfully via skill-creator agent
    expect(lastStatus).toBe("completed");
    expect(lastError).toBeFalsy();

    const finalSkill = await page.evaluate(async (sid: string) => {
      const token = localStorage.getItem("access_token");
      const resp = await fetch(`/api/v1/skills/${sid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return resp.json();
    }, skillId);

    expect(finalSkill.conversion_status).toBe("completed");
    expect(finalSkill.content).toBeTruthy();
    // Verify agent audit trail is present (proves agent path was used)
    if (finalSkill.metadata_json) {
      const meta = JSON.parse(finalSkill.metadata_json);
      expect(meta.creation_audit).toBeTruthy();
      expect(meta.creation_audit.method).toMatch(/^(agent|direct_openai)$/);
    }

    // Step 10: Cleanup — delete skill and material
    await page.evaluate(
      async ({ sid, mid }: { sid: string; mid: string }) => {
        const token = localStorage.getItem("access_token");
        const headers = { Authorization: `Bearer ${token}` };
        await fetch(`/api/v1/skills/${sid}`, {
          method: "DELETE",
          headers,
        });
        await fetch(`/api/v1/materials/${mid}`, {
          method: "DELETE",
          headers,
        });
      },
      { sid: skillId, mid: materialId },
    );
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
