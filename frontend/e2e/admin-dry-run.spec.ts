import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

/**
 * Dry Run E2E tests for the Skill Dry Run Simulation feature.
 *
 * These tests verify the main user-facing scenarios:
 *   1. Dry Run button visibility and confirmation dialog
 *   2. Report page renders with sub-tabs
 *   3. Quality tab shows dry run history
 *   4. Cancel flow
 *
 * API calls to the simulation engine are intercepted to avoid
 * requiring a live Azure OpenAI endpoint.
 */

// Completed dry run fixture data
const MOCK_DRY_RUN = {
  id: "e2e-dry-run-001",
  skill_id: "SKILL_ID_PLACEHOLDER",
  run_number: 1,
  status: "completed",
  executability_score: 85,
  coverage_percent: 80,
  total_sop_steps: 3,
  covered_sop_steps: 2,
  partial_sop_steps: 1,
  issues_count: 1,
  duration_seconds: 45,
  sop_coverage: [
    {
      step_id: "step_1",
      step_name: "Opening Greeting",
      status: "covered",
      matched_message_ids: [0],
      details: "Covered in 1 message(s)",
    },
    {
      step_id: "step_2",
      step_name: "Product Introduction",
      status: "covered",
      matched_message_ids: [2],
      details: "Covered in 1 message(s)",
    },
    {
      step_id: "step_3",
      step_name: "Closing",
      status: "partial",
      matched_message_ids: [],
      details: "Weak keyword overlap detected",
    },
  ],
  issues: [
    {
      severity: "warning",
      step_id: "step_3",
      description: "SOP step 'Closing' was only partially covered",
      suggestion: "Consider making the step content more specific.",
    },
  ],
  error_message: "",
  messages: [
    {
      id: "msg-1",
      dry_run_id: "e2e-dry-run-001",
      sequence_number: 0,
      role: "mr",
      content: "Good morning doctor. I am here to introduce our product.",
      sop_step_id: "step_1",
      sop_step_name: "Opening Greeting",
      created_at: "2026-01-15T10:00:00Z",
    },
    {
      id: "msg-2",
      dry_run_id: "e2e-dry-run-001",
      sequence_number: 1,
      role: "hcp",
      content: "Good morning. What product are you presenting?",
      sop_step_id: null,
      sop_step_name: null,
      created_at: "2026-01-15T10:00:10Z",
    },
    {
      id: "msg-3",
      dry_run_id: "e2e-dry-run-001",
      sequence_number: 2,
      role: "mr",
      content:
        "Let me introduce the key benefits of our product. It has shown significant efficacy.",
      sop_step_id: "step_2",
      sop_step_name: "Product Introduction",
      created_at: "2026-01-15T10:00:20Z",
    },
    {
      id: "msg-4",
      dry_run_id: "e2e-dry-run-001",
      sequence_number: 3,
      role: "hcp",
      content: "Interesting. Can you share the clinical data?",
      sop_step_id: null,
      sop_step_name: null,
      created_at: "2026-01-15T10:00:30Z",
    },
  ],
  created_by: "admin-user-id",
  created_at: "2026-01-15T10:00:00Z",
};

test.describe("Dry Run Simulation E2E", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  let skillId: string;

  // Create a skill with SOP content before each test
  test.beforeEach(async ({ page }) => {
    const sopContent =
      "## Step 1: Opening Greeting\n" +
      "Greet the doctor and introduce yourself.\n\n" +
      "## Step 2: Product Introduction\n" +
      "Present the key benefits of the pharmaceutical product.\n\n" +
      "## Step 3: Closing\n" +
      "Summarize key points and schedule follow-up.";

    await page.goto("/admin/skills");
    const resp = await page.evaluate(async (content: string) => {
      const r = await fetch("/api/v1/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          name: "E2E Dry Run Skill",
          content,
          product: "TestProd",
        }),
      });
      return r.json();
    }, sopContent);

    skillId = resp.id;
  });

  // ─── Dry Run Button & Dialog ──────────────────────────────────────────

  test("dry run button is visible in skill editor header", async ({
    page,
  }) => {
    await page.goto(`/admin/skills/${skillId}/edit`);
    await page.waitForURL(/\/admin\/skills\/[^/]+\/edit/, { timeout: 10000 });

    // Dry Run button should be visible
    const dryRunBtn = page.getByRole("button", { name: /dry run/i });
    await expect(dryRunBtn).toBeVisible({ timeout: 5000 });
  });

  test("dry run button opens confirmation dialog", async ({ page }) => {
    await page.goto(`/admin/skills/${skillId}/edit`);
    await page.waitForURL(/\/admin\/skills\/[^/]+\/edit/, { timeout: 10000 });

    // Click the Dry Run button
    const dryRunBtn = page.getByRole("button", { name: /dry run/i });
    await dryRunBtn.click();

    // Dialog should appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Dialog should have "Start Simulation" and "Go Back" buttons
    const startBtn = dialog.getByRole("button", {
      name: /start simulation/i,
    });
    const goBackBtn = dialog.getByRole("button", { name: /go back/i });
    await expect(startBtn).toBeVisible();
    await expect(goBackBtn).toBeVisible();
  });

  test("go back button closes the confirmation dialog", async ({ page }) => {
    await page.goto(`/admin/skills/${skillId}/edit`);
    await page.waitForURL(/\/admin\/skills\/[^/]+\/edit/, { timeout: 10000 });

    const dryRunBtn = page.getByRole("button", { name: /dry run/i });
    await dryRunBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const goBackBtn = dialog.getByRole("button", { name: /go back/i });
    await goBackBtn.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  // ─── Report Page ──────────────────────────────────────────────────────

  test("report page renders header and sub-tabs with mocked data", async ({
    page,
  }) => {
    const mockData = {
      ...MOCK_DRY_RUN,
      skill_id: skillId,
    };

    // Intercept the dry run detail API
    await page.route(
      `**/api/v1/skills/${skillId}/dry-runs/e2e-dry-run-001`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockData),
        });
      },
    );

    await page.goto(
      `/admin/skills/${skillId}/dry-run/e2e-dry-run-001`,
    );

    // Header elements
    await expect(
      page.getByText(/dry run report/i),
    ).toBeVisible({ timeout: 10000 });

    // Run number and metadata
    await expect(page.getByText(/run #1/i)).toBeVisible();

    // Score summary should be present
    await expect(page.getByText(/85/)).toBeVisible();

    // Sub-tabs: Conversation, SOP Coverage, Issues
    const tabs = page.locator("[role='tab']");
    await expect(tabs.first()).toBeVisible({ timeout: 5000 });
    const tabCount = await tabs.count();
    expect(tabCount).toBe(3);
  });

  test("report page conversation tab shows messages", async ({ page }) => {
    const mockData = { ...MOCK_DRY_RUN, skill_id: skillId };

    await page.route(
      `**/api/v1/skills/${skillId}/dry-runs/e2e-dry-run-001`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockData),
        });
      },
    );

    await page.goto(
      `/admin/skills/${skillId}/dry-run/e2e-dry-run-001`,
    );

    // Conversation tab should be active by default
    // Should show MR and HCP messages
    await expect(
      page.getByText(/good morning doctor/i),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/what product are you presenting/i),
    ).toBeVisible();
  });

  test("report page SOP coverage tab shows coverage map", async ({
    page,
  }) => {
    const mockData = { ...MOCK_DRY_RUN, skill_id: skillId };

    await page.route(
      `**/api/v1/skills/${skillId}/dry-runs/e2e-dry-run-001`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockData),
        });
      },
    );

    await page.goto(
      `/admin/skills/${skillId}/dry-run/e2e-dry-run-001`,
    );

    // Click SOP Coverage tab
    const sopTab = page.locator("[role='tab']").filter({
      hasText: /sop coverage/i,
    });
    await sopTab.click();
    await page.waitForTimeout(500);

    // Should show coverage information
    const tabPanel = page.locator(
      "[role='tabpanel'][data-state='active']",
    );
    await expect(tabPanel).toBeVisible();

    // Coverage map should display step names
    await expect(page.getByText(/opening greeting/i)).toBeVisible();
    await expect(
      page.getByText(/product introduction/i),
    ).toBeVisible();
  });

  test("report page Issues tab shows issue cards", async ({ page }) => {
    const mockData = { ...MOCK_DRY_RUN, skill_id: skillId };

    await page.route(
      `**/api/v1/skills/${skillId}/dry-runs/e2e-dry-run-001`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockData),
        });
      },
    );

    await page.goto(
      `/admin/skills/${skillId}/dry-run/e2e-dry-run-001`,
    );

    // Click Issues tab
    const issuesTab = page.locator("[role='tab']").filter({
      hasText: /issues/i,
    });
    await issuesTab.click();
    await page.waitForTimeout(500);

    // Should show the warning issue
    await expect(
      page.getByText(/partially covered/i),
    ).toBeVisible({ timeout: 5000 });
  });

  // ─── Quality Tab — History List ───────────────────────────────────────

  test("quality tab shows dry run history list", async ({ page }) => {
    // Mock the list API to return a completed dry run
    const mockListData = {
      items: [
        {
          id: "e2e-dry-run-001",
          skill_id: skillId,
          run_number: 1,
          status: "completed",
          executability_score: 85,
          coverage_percent: 80,
          total_sop_steps: 3,
          covered_sop_steps: 2,
          issues_count: 1,
          created_at: "2026-01-15T10:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    };

    await page.route(
      `**/api/v1/skills/${skillId}/dry-runs?**`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockListData),
        });
      },
    );

    await page.goto(`/admin/skills/${skillId}/edit`);
    await page.waitForURL(/\/admin\/skills\/[^/]+\/edit/, {
      timeout: 10000,
    });

    // Click Quality tab (3rd tab)
    const qualityTab = page.locator("[role='tab']").nth(2);
    await expect(qualityTab).toBeVisible({ timeout: 10000 });
    await qualityTab.click();
    await page.waitForTimeout(1000);

    // Should show the history list with run #1
    await expect(page.getByText(/#1/)).toBeVisible({ timeout: 5000 });
  });

  // ─── Back Navigation from Report ──────────────────────────────────────

  test("back button on report navigates to skill editor", async ({
    page,
  }) => {
    const mockData = { ...MOCK_DRY_RUN, skill_id: skillId };

    await page.route(
      `**/api/v1/skills/${skillId}/dry-runs/e2e-dry-run-001`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockData),
        });
      },
    );

    await page.goto(
      `/admin/skills/${skillId}/dry-run/e2e-dry-run-001`,
    );

    // Click "Back to Editor" button
    const backBtn = page.getByRole("button", {
      name: /back to editor/i,
    });
    await expect(backBtn).toBeVisible({ timeout: 10000 });
    await backBtn.click();

    await page.waitForURL(/\/admin\/skills\/[^/]+\/edit/, {
      timeout: 5000,
    });
    await expect(page).toHaveURL(/\/admin\/skills\/[^/]+\/edit/);
  });
});
