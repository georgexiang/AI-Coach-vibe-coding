import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Admin User Management Page", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/users");
  });

  test("renders page with heading", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText(/User Management/i);
  });

  test("shows user list table with column headers", async ({ page }) => {
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Check table headers
    await expect(page.getByRole("columnheader", { name: /Name/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Email/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Role/i })).toBeVisible();
  });

  test("shows user data rows", async ({ page }) => {
    // Mock data should show at least one user (e.g., Alice Wang)
    await expect(page.getByText("Alice Wang")).toBeVisible();
    await expect(page.getByText("alice.wang@beigene.com")).toBeVisible();
  });

  test("search input works", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search by name or email/i);
    await expect(searchInput).toBeVisible();

    // Type a search term
    await searchInput.fill("Alice");
    await page.waitForTimeout(300);

    // Alice should still be visible, but Bob should not
    await expect(page.getByText("Alice Wang")).toBeVisible();
    await expect(page.getByText("Bob Zhang")).not.toBeVisible();
  });

  test("filter dropdowns exist", async ({ page }) => {
    // Role filter, BU filter, and Status filter selects should be present
    // They are rendered as Select components with trigger buttons
    const selectTriggers = page.locator("button[role='combobox']");
    const count = await selectTriggers.count();
    // There should be at least 3 filter selects (Role, BU, Status)
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("add user button exists", async ({ page }) => {
    await expect(page.getByText(/Add User/i)).toBeVisible();
  });

  test("pagination controls exist with 12 mock users", async ({ page }) => {
    // With 12 users and PAGE_SIZE=10, pagination should be visible
    await expect(page.getByText(/Previous/i).first()).toBeVisible();
    await expect(page.getByText(/Next/i).first()).toBeVisible();
    await expect(page.getByText("1 / 2")).toBeVisible();
  });
});
