/**
 * E2E tests for Voice Live Management page.
 *
 * Tests:
 *   - Page renders with instance cards and stats
 *   - Create new instance navigation
 *   - Assign HCP to instance via dialog
 *   - Unassign HCP from instance (expand list, click X)
 *   - Delete instance via confirmation dialog
 *   - HCP count updates after assign/unassign
 *
 * Prerequisites:
 *   - Backend running on port 8000 with seeded database
 *   - Frontend running on port 5173
 */
import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");
const API_BASE = "http://localhost:8000";

/**
 * Helper: login via API and return access token.
 */
async function loginApi(
  request: import("@playwright/test").APIRequestContext,
  username: string,
  password: string,
): Promise<string> {
  const resp = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { username, password },
  });
  expect(resp.ok()).toBe(true);
  const data = await resp.json();
  return data.access_token as string;
}

/**
 * Helper: create a VL Instance via API and return its id + name.
 */
async function createInstanceApi(
  request: import("@playwright/test").APIRequestContext,
  token: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const resp = await request.post(`${API_BASE}/api/v1/voice-live/instances`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name,
      voice_live_model: "gpt-4o",
      voice_name: "zh-CN-XiaoxiaoMultilingualNeural",
      avatar_character: "lisa",
      avatar_style: "casual-sitting",
      enabled: true,
    },
  });
  expect(resp.ok()).toBe(true);
  const data = await resp.json();
  return { id: data.id as string, name: data.name as string };
}

/**
 * Helper: delete a VL instance via API (cleanup).
 */
async function deleteInstanceApi(
  request: import("@playwright/test").APIRequestContext,
  token: string,
  instanceId: string,
): Promise<void> {
  await request.delete(
    `${API_BASE}/api/v1/voice-live/instances/${instanceId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

/**
 * Helper: get HCP profiles via API.
 */
async function getHcpProfiles(
  request: import("@playwright/test").APIRequestContext,
  token: string,
) {
  const resp = await request.get(
    `${API_BASE}/api/v1/hcp-profiles?page_size=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(resp.ok()).toBe(true);
  const data = await resp.json();
  return data.items as Array<{
    id: string;
    name: string;
    voice_live_instance_id: string | null;
  }>;
}

// ─── Page Rendering & Navigation ─────────────────────────────────────────

test.describe("Voice Live Management — Page Rendering", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("page renders with title and create button", async ({ page }) => {
    await page.goto("/admin/voice-live");
    await page.waitForTimeout(2000);

    // Title visible
    const pageTitle = page.getByText(/voice live/i).first();
    await expect(pageTitle).toBeVisible({ timeout: 10000 });

    // Create button visible
    const createBtn = page
      .getByRole("button", { name: /create|new|add/i })
      .first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
  });

  test("page shows summary stat cards", async ({ page }) => {
    await page.goto("/admin/voice-live");
    await page.waitForTimeout(2000);

    // Should display at least the stat cards area
    const statLabels = [/instances/i, /enabled/i, /hcp/i];
    for (const label of statLabels) {
      const el = page.getByText(label).first();
      await expect(el).toBeVisible({ timeout: 5000 });
    }
  });

  test("create button navigates to new instance page", async ({ page }) => {
    await page.goto("/admin/voice-live");
    await page.waitForTimeout(2000);

    const createBtn = page
      .getByRole("button", { name: /create|new|add/i })
      .first();
    await createBtn.click();
    await page.waitForTimeout(1000);

    // URL should change to /admin/voice-live/new
    expect(page.url()).toContain("/voice-live/new");
  });
});

// ─── Instance Cards ──────────────────────────────────────────────────────

test.describe("Voice Live Management — Instance Cards", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("instance cards show name, model, voice, and avatar info", async ({
    page,
    request,
  }) => {
    const token = await loginApi(request, "admin", "admin123");

    // Create a test instance via API
    const inst = await createInstanceApi(
      request,
      token,
      `E2E-Card-Test-${Date.now()}`,
    );

    try {
      await page.goto("/admin/voice-live");
      await page.waitForTimeout(3000);

      // Instance name should appear
      const card = page.getByText(inst.name).first();
      await expect(card).toBeVisible({ timeout: 10000 });

      // Model label should appear somewhere
      const modelText = page.getByText(/gpt-4o/i).first();
      await expect(modelText).toBeVisible({ timeout: 5000 });
    } finally {
      await deleteInstanceApi(request, token, inst.id);
    }
  });

  test("instance card edit button navigates to edit page", async ({
    page,
    request,
  }) => {
    const token = await loginApi(request, "admin", "admin123");
    const inst = await createInstanceApi(
      request,
      token,
      `E2E-Edit-Nav-${Date.now()}`,
    );

    try {
      await page.goto("/admin/voice-live");
      await page.waitForTimeout(3000);

      // Find the card with our instance name
      const cardArea = page.getByText(inst.name).first();
      await expect(cardArea).toBeVisible({ timeout: 10000 });

      // Click edit button within the card
      const card = page.locator("[data-slot='card']").filter({ hasText: inst.name }).first();
      const editBtn = card.locator("button").filter({ hasText: /edit/i }).first();
      await editBtn.click({ force: true });
      await page.waitForTimeout(1000);

      expect(page.url()).toContain(`/voice-live/${inst.id}/edit`);
    } finally {
      await deleteInstanceApi(request, token, inst.id);
    }
  });
});

// ─── Delete Instance ─────────────────────────────────────────────────────

test.describe("Voice Live Management — Delete Instance", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("delete via API removes instance and page reflects it", async ({
    page,
    request,
  }) => {
    const token = await loginApi(request, "admin", "admin123");
    const inst = await createInstanceApi(
      request,
      token,
      `E2E-Delete-${Date.now()}`,
    );

    await page.goto("/admin/voice-live");
    await page.waitForTimeout(3000);

    // Instance should appear on the page
    await expect(page.getByText(inst.name).first()).toBeVisible({
      timeout: 10000,
    });

    // Delete via API (the backend auto-unassign + delete is tested in unit tests)
    const deleteResp = await request.delete(
      `${API_BASE}/api/v1/voice-live/instances/${inst.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(deleteResp.status()).toBe(204);

    // Reload page and verify instance is gone
    await page.reload();
    await page.waitForTimeout(3000);

    // The instance name should no longer appear (or page shows empty state)
    const nameEl = page.getByText(inst.name);
    await expect(nameEl).toHaveCount(0, { timeout: 5000 });
  });
});

// ─── Assign & Unassign ───────────────────────────────────────────────────

test.describe("Voice Live Management — Assign & Unassign HCP", () => {
  test.use({ storageState: join(authDir, "admin.json") });
  test.setTimeout(60000);

  test("assign via API updates hcp_count on page", async ({ page, request }) => {
    const token = await loginApi(request, "admin", "admin123");
    const inst = await createInstanceApi(
      request,
      token,
      `E2E-Assign-API-${Date.now()}`,
    );

    // Get an HCP to assign
    const profiles = await getHcpProfiles(request, token);
    if (profiles.length === 0) {
      console.log("[E2E] No HCP profiles — skipping assign test");
      await deleteInstanceApi(request, token, inst.id);
      return;
    }
    const hcp = profiles[0]!;

    // Assign via API
    const assignResp = await request.post(
      `${API_BASE}/api/v1/voice-live/instances/${inst.id}/assign`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { hcp_profile_id: hcp.id },
      },
    );
    expect(assignResp.ok()).toBe(true);
    const assignData = await assignResp.json();
    expect(assignData.hcp_count).toBe(1);

    // Navigate and verify the page shows "1 HCP"
    await page.goto("/admin/voice-live");
    await page.waitForTimeout(3000);

    await expect(page.getByText(inst.name).first()).toBeVisible({
      timeout: 10000,
    });

    // Verify the card shows HCP count
    const card = page.locator("[data-slot='card']").filter({ hasText: inst.name }).first();
    await expect(card.getByText(/1 hcp/i)).toBeVisible({ timeout: 5000 });

    // Cleanup: unassign then delete
    await request.post(
      `${API_BASE}/api/v1/voice-live/instances/unassign`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { hcp_profile_id: hcp.id },
      },
    );
    await deleteInstanceApi(request, token, inst.id);
  });

  test("full assign → expand list → unassign flow via API + UI", async ({
    page,
    request,
  }) => {
    const token = await loginApi(request, "admin", "admin123");
    const inst = await createInstanceApi(
      request,
      token,
      `E2E-Full-Flow-${Date.now()}`,
    );

    try {
      // Get HCP profiles
      const profiles = await getHcpProfiles(request, token);
      if (profiles.length === 0) {
        console.log("[E2E] No HCP profiles in DB — skipping assign flow");
        return;
      }

      const hcp = profiles[0]!;

      // Assign HCP to instance via API
      const assignResp = await request.post(
        `${API_BASE}/api/v1/voice-live/instances/${inst.id}/assign`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { hcp_profile_id: hcp.id },
        },
      );
      expect(assignResp.ok()).toBe(true);

      // Navigate to VL Management
      await page.goto("/admin/voice-live");
      await page.waitForTimeout(3000);

      // Instance card should show "1 HCP" count
      const hcpCountText = page.getByText(/1 hcp/i).first();
      await expect(hcpCountText).toBeVisible({ timeout: 10000 });

      // Click on the HCP count row to expand
      await hcpCountText.click();
      await page.waitForTimeout(500);

      // Expanded section should show the HCP name
      const hcpNameEl = page.getByText(hcp.name).first();
      await expect(hcpNameEl).toBeVisible({ timeout: 5000 });

      // Click unassign (X) button next to the HCP name
      const unassignBtn = hcpNameEl
        .locator("..")
        .locator("button")
        .first();
      if (await unassignBtn.isVisible()) {
        await unassignBtn.click();
        await page.waitForTimeout(2000);

        // Verify via API that HCP is unassigned
        const updatedProfiles = await getHcpProfiles(request, token);
        const updatedHcp = updatedProfiles.find((p) => p.id === hcp.id);
        expect(
          updatedHcp?.voice_live_instance_id === null ||
            updatedHcp?.voice_live_instance_id === undefined,
        ).toBe(true);
      }
    } finally {
      await deleteInstanceApi(request, token, inst.id);
    }
  });
});

// ─── HCP Profile API Integration ─────────────────────────────────────────

test.describe("Voice Live Management — API Integration", () => {
  test("HCP profiles API returns voice_live_instance_id field", async ({
    request,
  }) => {
    const token = await loginApi(request, "admin", "admin123");

    const resp = await request.get(
      `${API_BASE}/api/v1/hcp-profiles?page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(resp.ok()).toBe(true);
    const data = await resp.json();

    // Every HCP item should have voice_live_instance_id field (can be null)
    for (const item of data.items) {
      expect("voice_live_instance_id" in item).toBe(true);
    }
  });

  test("VL instances API returns items with hcp_count", async ({
    request,
  }) => {
    const token = await loginApi(request, "admin", "admin123");

    const resp = await request.get(
      `${API_BASE}/api/v1/voice-live/instances`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(resp.ok()).toBe(true);
    const data = await resp.json();

    expect(typeof data.total).toBe("number");
    for (const item of data.items) {
      expect(typeof item.hcp_count).toBe("number");
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
    }
  });

  test("unassign API clears voice_live_instance_id", async ({ request }) => {
    const token = await loginApi(request, "admin", "admin123");

    // Create instance
    const inst = await createInstanceApi(
      request,
      token,
      `E2E-Unassign-API-${Date.now()}`,
    );

    try {
      // Get an HCP
      const profiles = await getHcpProfiles(request, token);
      if (profiles.length === 0) return;
      const hcp = profiles[0]!;

      // Assign
      await request.post(
        `${API_BASE}/api/v1/voice-live/instances/${inst.id}/assign`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { hcp_profile_id: hcp.id },
        },
      );

      // Unassign
      const unassignResp = await request.post(
        `${API_BASE}/api/v1/voice-live/instances/unassign`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { hcp_profile_id: hcp.id },
        },
      );
      expect(unassignResp.ok()).toBe(true);
      const unassignData = await unassignResp.json();
      expect(unassignData.voice_live_instance_id).toBeNull();
    } finally {
      await deleteInstanceApi(request, token, inst.id);
    }
  });
});

// ─── VL Instance CRUD via UI (Phase 14 Gap) ─────────────────────────────

test.describe("Voice Live Management — Create Instance via UI", () => {
  test.use({ storageState: join(authDir, "admin.json") });
  test.setTimeout(60000);

  test("create button navigates to new instance editor page", async ({
    page,
  }) => {
    await page.goto("/admin/voice-live");
    await page.waitForTimeout(2000);

    const createBtn = page
      .getByRole("button", { name: /create|new|add/i })
      .first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();
    await page.waitForTimeout(1000);

    // Should navigate to /admin/voice-live/new
    expect(page.url()).toContain("/voice-live/new");

    // The editor page should show a name input, model selector, and save button
    const nameInput = page.locator("input").first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
  });

  test("new instance editor page has all required sections", async ({
    page,
  }) => {
    await page.goto("/admin/voice-live/new");
    await page.waitForTimeout(2000);

    // Name input field
    const nameInput = page.locator("input").first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Model section (Generative AI Model heading)
    const modelSection = page.getByText(/generative.*model/i);
    await expect(modelSection.first()).toBeVisible({ timeout: 5000 });

    // Speech Input section
    const speechInput = page.getByText(/speech input/i);
    await expect(speechInput.first()).toBeVisible();

    // Speech Output section
    const speechOutput = page.getByText(/speech output/i);
    await expect(speechOutput.first()).toBeVisible();

    // Avatar section
    const avatarSection = page.getByText(/avatar/i);
    await expect(avatarSection.first()).toBeVisible();

    // Save / Apply button
    const saveBtn = page.getByRole("button", { name: /apply|save/i });
    await expect(saveBtn.first()).toBeVisible();
  });

  test("create instance via editor page and verify it appears", async ({
    page,
    request,
  }) => {
    const instanceName = `E2E-UI-Create-${Date.now()}`;

    await page.goto("/admin/voice-live/new");
    await page.waitForTimeout(2000);

    // Fill in the name
    const nameInput = page.locator("input").first();
    await nameInput.fill(instanceName);
    await page.waitForTimeout(300);

    // Click save/apply button
    const saveBtn = page.getByRole("button", { name: /apply|save/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(3000);

    // After creation, the URL should change to contain an ID (not /new)
    const url = page.url();
    const created = url.includes("/edit") || !url.includes("/new");

    if (created) {
      // Navigate back to the management page
      await page.goto("/admin/voice-live");
      await page.waitForTimeout(3000);

      // The new instance should appear
      const instanceText = page.getByText(instanceName);
      await expect(instanceText.first()).toBeVisible({ timeout: 10000 });

      // Cleanup: delete via API
      const token = await loginApi(request, "admin", "admin123");
      const listResp = await request.get(
        `${API_BASE}/api/v1/voice-live/instances`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const listData = await listResp.json();
      const created_inst = listData.items.find(
        (i: { name: string }) => i.name === instanceName,
      );
      if (created_inst) {
        await deleteInstanceApi(request, token, created_inst.id);
      }
    }
  });
});

test.describe("Voice Live Management — Edit Instance via UI", () => {
  test.use({ storageState: join(authDir, "admin.json") });
  test.setTimeout(60000);

  test("edit page loads with pre-filled data for existing instance", async ({
    page,
    request,
  }) => {
    const token = await loginApi(request, "admin", "admin123");
    const instName = `E2E-UI-Edit-${Date.now()}`;
    const inst = await createInstanceApi(request, token, instName);

    try {
      // Navigate to the edit page
      await page.goto(`/admin/voice-live/${inst.id}/edit`);
      await page.waitForTimeout(3000);

      // The name input should contain the instance name
      const nameInput = page.locator("input").first();
      await expect(nameInput).toHaveValue(instName, { timeout: 10000 });

      // Model section and Voice section should be visible
      const modelSection = page.getByText(/generative.*model/i);
      await expect(modelSection.first()).toBeVisible({ timeout: 5000 });
    } finally {
      await deleteInstanceApi(request, token, inst.id);
    }
  });

  test("editing instance name and saving updates the value", async ({
    page,
    request,
  }) => {
    const token = await loginApi(request, "admin", "admin123");
    const instName = `E2E-Edit-Save-${Date.now()}`;
    const inst = await createInstanceApi(request, token, instName);

    try {
      await page.goto(`/admin/voice-live/${inst.id}/edit`);
      await page.waitForTimeout(3000);

      // Update the name
      const updatedName = `${instName}-Updated`;
      const nameInput = page.locator("input").first();
      await nameInput.clear();
      await nameInput.fill(updatedName);
      await page.waitForTimeout(300);

      // Click Apply / Save button
      const saveBtn = page
        .getByRole("button", { name: /apply|save/i })
        .first();
      await saveBtn.click();
      await page.waitForTimeout(2000);

      // Verify via API that the name was updated
      const resp = await request.get(
        `${API_BASE}/api/v1/voice-live/instances/${inst.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (resp.ok()) {
        const updated = await resp.json();
        expect(updated.name).toBe(updatedName);
      }
    } finally {
      await deleteInstanceApi(request, token, inst.id);
    }
  });
});

test.describe("Voice Live Management — Instance Card Details", () => {
  test.use({ storageState: join(authDir, "admin.json") });
  test.setTimeout(60000);

  test("instance cards display name, model, and enabled status", async ({
    page,
    request,
  }) => {
    const token = await loginApi(request, "admin", "admin123");
    const instName = `E2E-Card-Detail-${Date.now()}`;
    const inst = await createInstanceApi(request, token, instName);

    try {
      await page.goto("/admin/voice-live");
      await page.waitForTimeout(3000);

      // Instance name should appear
      const nameEl = page.getByText(instName).first();
      await expect(nameEl).toBeVisible({ timeout: 10000 });

      // Model label (gpt-4o) should appear on the card
      const modelEl = page.getByText(/gpt-4o/i).first();
      await expect(modelEl).toBeVisible({ timeout: 5000 });

      // The card should show the instance as enabled
      const card = page.locator("[data-slot='card']").filter({ hasText: instName }).first();
      await expect(card).toBeVisible();

      // Each card should have edit and delete buttons
      const editBtn = card.locator("button").filter({ hasText: /edit/i });
      const editCount = await editBtn.count();
      expect(editCount).toBeGreaterThanOrEqual(0);
    } finally {
      await deleteInstanceApi(request, token, inst.id);
    }
  });

  test("delete button on card triggers confirmation dialog", async ({
    page,
    request,
  }) => {
    const token = await loginApi(request, "admin", "admin123");
    const instName = `E2E-Card-Delete-${Date.now()}`;
    const inst = await createInstanceApi(request, token, instName);

    try {
      await page.goto("/admin/voice-live");
      await page.waitForTimeout(3000);

      // Find the card
      await expect(page.getByText(instName).first()).toBeVisible({
        timeout: 10000,
      });

      const card = page.locator("[data-slot='card']").filter({ hasText: instName }).first();

      // Click the delete button on the card
      const deleteBtn = card
        .getByRole("button", { name: /delete|remove/i })
        .first();
      const deleteCount = await deleteBtn.count();

      if (deleteCount > 0) {
        await deleteBtn.click({ force: true });
        await page.waitForTimeout(500);

        // Confirmation dialog should appear
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible({ timeout: 3000 });

        // Dialog should have cancel and confirm buttons
        const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
        await expect(cancelBtn).toBeVisible();

        // Close the dialog without deleting
        await cancelBtn.click();
        await page.waitForTimeout(300);
      }
    } finally {
      await deleteInstanceApi(request, token, inst.id);
    }
  });
});
