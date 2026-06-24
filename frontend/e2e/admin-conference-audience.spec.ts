import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

/**
 * E2E for issue #13 — conference scenarios binding multiple HCPs.
 * Verifies the admin can configure 2-5 HCP audience members on a
 * conference-mode scenario (the core multi-HCP binding flow).
 */
test.describe("Admin Conference Audience (multi-HCP binding)", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  async function openConferenceLinkedTab(page: import("@playwright/test").Page) {
    await page.goto("/admin/scenarios/new");
    await expect(page.getByRole("tab", { name: /basic/i })).toBeVisible({
      timeout: 15000,
    });

    // Select conference mode on the Basic tab
    await page.getByRole("radio", { name: /conference/i }).check();

    // Switch to the Linked config tab
    await page.getByRole("tab", { name: /linked/i }).click();
  }

  test("audience config is hidden for f2f and shown for conference", async ({
    page,
  }) => {
    await page.goto("/admin/scenarios/new");
    await expect(page.getByRole("tab", { name: /basic/i })).toBeVisible({
      timeout: 15000,
    });

    // Default mode is f2f -> linked tab has no audience config
    await page.getByRole("tab", { name: /linked/i }).click();
    await expect(
      page.getByTestId("conference-audience-config"),
    ).toHaveCount(0);

    // Switch to conference -> audience config appears
    await page.getByRole("tab", { name: /basic/i }).click();
    await page.getByRole("radio", { name: /conference/i }).check();
    await page.getByRole("tab", { name: /linked/i }).click();
    await expect(
      page.getByTestId("conference-audience-config"),
    ).toBeVisible();
  });

  test("shows minimum-HCP guidance until 2 members are added", async ({
    page,
  }) => {
    await openConferenceLinkedTab(page);

    const config = page.getByTestId("conference-audience-config");
    await expect(config).toBeVisible();

    // With 0 members the minimum hint is shown
    await expect(config.getByText(/at least 2 hcps/i)).toBeVisible();

    // Add two members
    const addButton = page.getByRole("button", { name: /add hcp/i });
    await addButton.click();
    await addButton.click();

    // Two HCP selectors and two remove buttons exist
    await expect(page.getByLabel("Select HCP")).toHaveCount(2);
    await expect(page.getByRole("button", { name: /remove hcp/i })).toHaveCount(
      2,
    );

    // Minimum hint disappears once 2 rows exist
    await expect(config.getByText(/at least 2 hcps/i)).toHaveCount(0);
  });

  test("can add up to 5 HCPs and remove members", async ({ page }) => {
    await openConferenceLinkedTab(page);

    const addButton = page.getByRole("button", { name: /add hcp/i });
    for (let i = 0; i < 5; i++) {
      await addButton.click();
    }

    // Capped at 5 rows; Add button disabled at max
    await expect(page.getByLabel("Select HCP")).toHaveCount(5);
    await expect(addButton).toBeDisabled();

    // Remove one -> 4 rows, Add re-enabled
    await page.getByRole("button", { name: /remove hcp/i }).first().click();
    await expect(page.getByLabel("Select HCP")).toHaveCount(4);
    await expect(addButton).toBeEnabled();
  });

  test("binding two distinct HCPs clears validation hints", async ({
    page,
  }) => {
    await openConferenceLinkedTab(page);

    const addButton = page.getByRole("button", { name: /add hcp/i });
    await addButton.click();
    await addButton.click();

    const selects = page.getByLabel("Select HCP");

    // Open the first HCP selector and pick the first option (if seeded)
    await selects.nth(0).click();
    const firstOptions = page.getByRole("option");
    const optionCount = await firstOptions.count();
    test.skip(optionCount < 2, "Requires at least 2 seeded HCP profiles");

    await firstOptions.nth(0).click();

    // Open the second selector and pick a different option
    await selects.nth(1).click();
    await page.getByRole("option").nth(1).click();

    const config = page.getByTestId("conference-audience-config");
    // No duplicate or minimum warnings remain
    await expect(config.getByText(/duplicate hcp/i)).toHaveCount(0);
    await expect(config.getByText(/at least 2 hcps/i)).toHaveCount(0);
  });
});
