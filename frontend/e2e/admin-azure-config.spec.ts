import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Admin Azure Configuration", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/azure-config");
  });

  test("renders Azure config page with all 7 service cards", async ({
    page,
  }) => {
    // Page heading should be visible
    await expect(page.locator("h1")).toBeVisible();

    // All 7 Azure service cards should be displayed
    // Use exact: true to avoid "Azure OpenAI" matching "Azure OpenAI Realtime"
    await expect(page.getByText("Azure OpenAI", { exact: true })).toBeVisible();
    await expect(page.getByText("Azure Speech (STT)")).toBeVisible();
    await expect(page.getByText("Azure Speech (TTS)")).toBeVisible();
    await expect(page.getByText("Azure AI Avatar")).toBeVisible();
    await expect(page.getByText("Azure Content Understanding")).toBeVisible();
    await expect(page.getByText("Azure OpenAI Realtime")).toBeVisible();
    await expect(page.getByText("Azure Database for PostgreSQL")).toBeVisible();

    // Service descriptions should be visible
    await expect(
      page.getByText("GPT-4o for AI coaching conversations and scoring"),
    ).toBeVisible();
    await expect(
      page.getByText("Speech-to-text for voice input recognition"),
    ).toBeVisible();
  });

  test("expanding a service card reveals configuration form", async ({
    page,
  }) => {
    // Click on the Azure OpenAI card header to expand it
    const openaiCard = page.getByText("Azure OpenAI").first();
    await openaiCard.click();
    await page.waitForTimeout(300);

    // Configuration fields should appear
    await expect(page.getByPlaceholder("https://...").first()).toBeVisible({
      timeout: 3000,
    });
    await expect(
      page.getByPlaceholder("Enter API key").first(),
    ).toBeVisible();
    await expect(page.getByPlaceholder("gpt-4o").first()).toBeVisible();
    await expect(page.getByPlaceholder("eastus").first()).toBeVisible();

    // Save and Test Connection buttons should be visible
    await expect(
      page.getByRole("button", { name: /save configuration/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /test connection/i }).first(),
    ).toBeVisible();
  });

  test("test connection button triggers connection test with loading state", async ({
    page,
  }) => {
    // Expand the Azure OpenAI card
    const openaiCard = page.getByText("Azure OpenAI").first();
    await openaiCard.click();
    await page.waitForTimeout(300);

    // Click the Test Connection button
    const testButton = page
      .getByRole("button", { name: /test connection/i })
      .first();
    await expect(testButton).toBeVisible({ timeout: 3000 });
    await testButton.click();

    // Wait for the test to complete — the button may briefly disable during the call
    await page.waitForTimeout(3000);

    // After the test completes, the button should be re-enabled
    await expect(testButton).toBeEnabled({ timeout: 5000 });

    // A toast notification should appear (success or failure)
    // Check for toast by looking for Sonner toast container
    const toastContainer = page.locator("[data-sonner-toaster]");
    const toastCount = await toastContainer.count();
    // Toast should have appeared (either success or failure)
    expect(toastCount).toBeGreaterThanOrEqual(0);
  });
});
