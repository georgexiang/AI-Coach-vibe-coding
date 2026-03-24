import { test as setup, expect } from "@playwright/test";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

setup.beforeAll(() => {
  mkdirSync(authDir, { recursive: true });
});

setup("authenticate as regular user", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#username").fill("user1");
  await page.locator("#password").fill("user123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/user/dashboard");
  await expect(page).toHaveURL(/\/user\/dashboard/);
  await context.storageState({ path: join(authDir, "user.json") });
  await context.close();
});

setup("authenticate as admin", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#username").fill("admin");
  await page.locator("#password").fill("admin123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await context.storageState({ path: join(authDir, "admin.json") });
  await context.close();
});
