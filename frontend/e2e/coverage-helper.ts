/**
 * Playwright coverage helper — collects Istanbul coverage from window.__coverage__
 * and writes it to .nyc_output/ for nyc report generation.
 */
import { test as base, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const nycOutputDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".nyc_output"
);

/**
 * Collect Istanbul coverage data from a page and write to .nyc_output/.
 * No-op if coverage instrumentation is not enabled.
 */
export async function collectCoverage(page: Page, testName: string) {
  try {
    const coverage = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__coverage__ ?? null;
    });
    if (coverage) {
      mkdirSync(nycOutputDir, { recursive: true });
      const safeName = testName.replace(/[^a-zA-Z0-9_-]/g, "_");
      writeFileSync(
        join(nycOutputDir, `${safeName}-${randomUUID()}.json`),
        JSON.stringify(coverage)
      );
    }
  } catch {
    // Page may have navigated away or closed — silently ignore
  }
}

/**
 * Extended test fixture that auto-collects coverage after each test.
 * Use `import { test } from './coverage-helper'` instead of `@playwright/test`
 * when you want coverage collection.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page);
    await collectCoverage(page, base.info().title);
  },
});

export { expect } from "@playwright/test";
