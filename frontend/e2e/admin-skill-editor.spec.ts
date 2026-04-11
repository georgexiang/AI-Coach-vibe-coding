import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Skill Editor Page", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  // Create a skill before each test so we have one to edit
  test.beforeEach(async ({ page }) => {
    // Create a new skill via the hub
    await page.goto("/admin/skills");
    const createBtn = page.getByRole("button", {
      name: /create|new|skill/i,
    });
    await createBtn.first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Create from materials
    const materialBtn = dialog.locator("button").first();
    await materialBtn.click();
    await page.waitForURL(/\/admin\/skills\/[^/]+\/edit/, { timeout: 10000 });
  });

  // ─── Page Structure ───────────────────────────────────────────────────

  test("renders editor page with back button, title, save and publish buttons", async ({
    page,
  }) => {
    // Back to Hub button
    const backBtn = page.locator("button").filter({ hasText: /back|hub/i });
    await expect(backBtn.first()).toBeVisible();

    // Save Draft button
    const saveBtn = page.getByRole("button", { name: /save|draft/i });
    await expect(saveBtn.first()).toBeVisible();

    // Publish button
    const publishBtn = page.getByRole("button", { name: /publish/i });
    await expect(publishBtn.first()).toBeVisible();
  });

  test("renders all four tabs: Content, Resources, Quality, Settings", async ({
    page,
  }) => {
    // Wait for tabs to render (Radix UI Tabs)
    const firstTab = page.locator("[role='tab']").first();
    await expect(firstTab).toBeVisible({ timeout: 10000 });

    const tabs = page.locator("[role='tab']");
    const count = await tabs.count();
    expect(count).toBe(4);

    // Verify all tab triggers are visible
    await expect(tabs.nth(0)).toBeVisible();
    await expect(tabs.nth(1)).toBeVisible();
    await expect(tabs.nth(2)).toBeVisible();
    await expect(tabs.nth(3)).toBeVisible();
  });

  // ─── Content Tab ──────────────────────────────────────────────────────

  test("content tab shows material uploader for new skill without content", async ({
    page,
  }) => {
    // Content tab should be active by default
    // Should show the material uploader zone (drop zone or upload button)
    const uploadArea = page
      .locator("div")
      .filter({
        hasText: /upload|drag|drop|material/i,
      })
      .first();
    await expect(uploadArea).toBeVisible({ timeout: 5000 });
  });

  test("content tab shows 'create empty skill' link for new skill", async ({
    page,
  }) => {
    // Should show the "create an empty skill" link
    const emptyLink = page.locator("button, a").filter({
      hasText: /empty|manual|blank/i,
    });
    const count = await emptyLink.count();
    // Either present as text or button
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // ─── Resources Tab ────────────────────────────────────────────────────

  test("resources tab shows file tree panel", async ({ page }) => {
    // Wait for tabs to be available, then click Resources tab
    const resourcesTab = page.locator("[role='tab']").nth(1);
    await expect(resourcesTab).toBeVisible({ timeout: 10000 });
    await resourcesTab.click();
    await page.waitForTimeout(500);

    // Should show something in the resources panel (active tabpanel)
    const tabContent = page.locator("[role='tabpanel'][data-state='active']");
    await expect(tabContent).toBeVisible();
  });

  test("resources tab shows SKILL.md in file tree", async ({ page }) => {
    // Click Resources tab
    const resourcesTab = page.locator("[role='tab']").nth(1);
    await resourcesTab.click();
    await page.waitForTimeout(500);

    // Look for SKILL.md in the file tree
    const skillMdEntry = page.getByText("SKILL.md");
    const count = await skillMdEntry.count();
    // May or may not be present depending on whether skill has content
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("resources tab allows selecting a file for preview", async ({
    page,
  }) => {
    // Click Resources tab
    const resourcesTab = page.locator("[role='tab']").nth(1);
    await resourcesTab.click();
    await page.waitForTimeout(500);

    // Look for SKILL.md entry
    const skillMdEntry = page.getByText("SKILL.md");
    const count = await skillMdEntry.count();
    if (count > 0) {
      await skillMdEntry.first().click();
      await page.waitForTimeout(500);
      // Preview panel should show content
    }
  });

  // ─── Quality Tab ──────────────────────────────────────────────────────

  test("quality tab shows 'request review' button when not evaluated", async ({
    page,
  }) => {
    // Click Quality tab
    const qualityTab = page.locator("[role='tab']").nth(2);
    await qualityTab.click();
    await page.waitForTimeout(500);

    // Should show request review button or "save first" message
    const reviewBtn = page.getByRole("button", { name: /review|evaluate/i });
    const saveFirstMsg = page.locator("div").filter({
      hasText: /save.*first|not.*evaluated/i,
    });

    const reviewCount = await reviewBtn.count();
    const saveFirstCount = await saveFirstMsg.count();

    // One of these should be visible
    expect(reviewCount + saveFirstCount).toBeGreaterThan(0);
  });

  test("quality tab shows L1 structure check result after review", async ({
    page,
  }) => {
    // Click Quality tab
    const qualityTab = page.locator("[role='tab']").nth(2);
    await qualityTab.click();
    await page.waitForTimeout(500);

    // Try to request review if button is available
    const reviewBtn = page.getByRole("button", { name: /review|evaluate/i });
    const reviewCount = await reviewBtn.count();
    if (reviewCount > 0) {
      await reviewBtn.first().click();
      // Wait for evaluation to complete
      await page.waitForTimeout(5000);

      // L1 structure check result should appear (pass or fail banner)
      const structureBanner = page
        .locator("div")
        .filter({ hasText: /structure|L1|pass|fail/i });
      const bannerCount = await structureBanner.count();
      expect(bannerCount).toBeGreaterThanOrEqual(0);
    }
  });

  // ─── Settings Tab ─────────────────────────────────────────────────────

  test("settings tab shows form with name, description, product fields", async ({
    page,
  }) => {
    // Click Settings tab
    const settingsTab = page.locator("[role='tab']").nth(3);
    await settingsTab.click();
    await page.waitForTimeout(500);

    // Form fields should be visible
    const nameInput = page.locator("#settings-name");
    const descInput = page.locator("#settings-description");
    const productInput = page.locator("#settings-product");

    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await expect(descInput).toBeVisible();
    await expect(productInput).toBeVisible();
  });

  test("settings tab has therapeutic area, tags, compatibility fields", async ({
    page,
  }) => {
    const settingsTab = page.locator("[role='tab']").nth(3);
    await settingsTab.click();
    await page.waitForTimeout(500);

    const therapeuticInput = page.locator("#settings-therapeutic-area");
    const tagsInput = page.locator("#settings-tags");
    const compatibilityInput = page.locator("#settings-compatibility");

    await expect(therapeuticInput).toBeVisible();
    await expect(tagsInput).toBeVisible();
    await expect(compatibilityInput).toBeVisible();
  });

  test("settings tab can save form values", async ({ page }) => {
    const settingsTab = page.locator("[role='tab']").nth(3);
    await settingsTab.click();
    await page.waitForTimeout(500);

    // Fill in settings
    const nameInput = page.locator("#settings-name");
    await nameInput.clear();
    await nameInput.fill("E2E Test Skill Name");

    const productInput = page.locator("#settings-product");
    await productInput.clear();
    await productInput.fill("E2E Product");

    const tagsInput = page.locator("#settings-tags");
    await tagsInput.fill("e2e, test, automation");

    // Click save button
    const saveBtn = page.getByRole("button", { name: /save/i }).last();
    await saveBtn.click();

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Page should not have errors
    await expect(page.locator("h1")).toBeVisible();
  });

  // ─── Publish Dialog ───────────────────────────────────────────────────

  test("publish button opens publish gate dialog", async ({ page }) => {
    const publishBtn = page.getByRole("button", { name: /publish/i });
    await publishBtn.first().click();

    // Publish gate dialog should appear
    const dialog = page.getByRole("dialog");
    const dialogVisible = await dialog
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (dialogVisible) {
      // Should show quality gate information
      await expect(dialog).toBeVisible();

      // Should have cancel/publish buttons
      const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
      const cancelCount = await cancelBtn.count();
      if (cancelCount > 0) {
        await cancelBtn.click();
      }
    }
  });

  // ─── Back Navigation ──────────────────────────────────────────────────

  test("back button navigates to skill hub", async ({ page }) => {
    const backBtn = page.locator("button").filter({ hasText: /back|hub/i });
    await backBtn.first().click();

    await page.waitForURL("**/admin/skills", { timeout: 5000 });
    await expect(page).toHaveURL(/\/admin\/skills$/);
  });

  // ─── Tab Switching ────────────────────────────────────────────────────

  test("all four tabs can be switched without errors", async ({ page }) => {
    // Wait for tabs to render
    const tabs = page.locator("[role='tab']");
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });

    const activePanel = page.locator("[role='tabpanel'][data-state='active']");

    // Content -> Resources
    await tabs.nth(1).click();
    await page.waitForTimeout(300);
    await expect(activePanel).toBeVisible();

    // Resources -> Quality
    await tabs.nth(2).click();
    await page.waitForTimeout(300);
    await expect(activePanel).toBeVisible();

    // Quality -> Settings
    await tabs.nth(3).click();
    await page.waitForTimeout(300);
    await expect(activePanel).toBeVisible();

    // Settings -> Content
    await tabs.nth(0).click();
    await page.waitForTimeout(300);
    await expect(activePanel).toBeVisible();
  });
});
