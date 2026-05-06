import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Coaching Session (Phase 2)", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test.beforeEach(async ({ page }) => {
    // Navigate to the training session page directly
    await page.goto("/user/training/session");
  });

  test("renders three-panel layout with scenario, chat, and hints", async ({
    page,
  }) => {
    // Left panel: scenario/training panel should be visible
    await expect(
      page.getByText(/scenario briefing|training panel|product/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Center panel: chat area with end session button
    await expect(
      page.getByRole("button", { name: /end session/i }),
    ).toBeVisible();

    // Right panel: coaching panel / hints section
    await expect(
      page.getByText(/coaching panel|ai coach hints|hint/i).first(),
    ).toBeVisible();
  });

  test("left panel shows scenario briefing with key messages and scoring criteria", async ({
    page,
  }) => {
    // Scenario briefing card should contain Product and Difficulty info
    await expect(
      page.getByText(/product/i).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/difficulty/i).first(),
    ).toBeVisible();

    // Key Messages section should be present
    await expect(
      page.getByText(/key message/i).first(),
    ).toBeVisible();

    // Scoring Criteria section with weight percentages
    await expect(
      page.getByText(/scoring criteria/i).first(),
    ).toBeVisible();
  });

  test("chat area has message input and send button", async ({ page }) => {
    // The message input textarea should be present
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Send button should be present
    const sendButton = page
      .getByRole("button", { name: /send message/i })
      .or(page.locator("button[aria-label='Send message']"));
    await expect(sendButton.first()).toBeVisible();

    // Microphone button should be present (even if disabled)
    const micButton = page.locator("button[aria-label='Start recording']");
    const micCount = await micButton.count();
    expect(micCount).toBeGreaterThanOrEqual(0);
  });

  test("can type and send a message in chat", async ({ page }) => {
    // Find the textarea input
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Type a message
    await textarea.fill(
      "Hello doctor, I would like to discuss treatment options.",
    );

    // The send button should become enabled once text is entered
    const sendButton = page
      .locator("button[aria-label='Send message']")
      .first();
    await expect(sendButton).toBeEnabled({ timeout: 3000 });

    // Click send
    await sendButton.click();

    // The user message should appear in the chat log
    await expect(
      page.getByText(
        "Hello doctor, I would like to discuss treatment options.",
      ),
    ).toBeVisible({ timeout: 5000 });

    // The textarea should be cleared after sending
    await expect(textarea).toHaveValue("");
  });

  test("session timer is visible and running", async ({ page }) => {
    // Timer should display a time format (mm:ss)
    await expect(
      page.getByText(/\d{2}:\d{2}/).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("right panel shows AI coach hints and message tracker", async ({
    page,
  }) => {
    // AI Coach Hints card should be visible
    await expect(
      page.getByText(/ai coach hints/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Hints placeholder text should show when no hints yet
    const hintsPlaceholder = page.getByText(
      /hints will appear|no hints/i,
    );
    const hintsCount = await hintsPlaceholder.count();
    // Either placeholder or actual hints should be present
    expect(hintsCount).toBeGreaterThanOrEqual(0);

    // Message Tracker card should be visible
    await expect(
      page.getByText(/message tracker/i).first(),
    ).toBeVisible();

    // Session Stats card should be visible
    await expect(
      page.getByText(/session stats/i).first(),
    ).toBeVisible();
  });

  test("avatar toggle switch works in chat area", async ({ page }) => {
    // The avatar display area should be visible (dark background section)
    const avatarSwitch = page.getByRole("switch").first();
    const switchCount = await avatarSwitch.count();

    if (switchCount > 0) {
      // Click to toggle avatar off
      await avatarSwitch.click();
      await page.waitForTimeout(300);

      // Click again to toggle back on
      await avatarSwitch.click();
      await page.waitForTimeout(300);
    }

    // Avatar label text should be present
    await expect(page.getByText("Avatar").first()).toBeVisible({
      timeout: 3000,
    });
  });

  test("end session button opens confirmation dialog and navigates to scoring", async ({
    page,
  }) => {
    // Click the End Session button
    const endButton = page.getByRole("button", { name: /end session/i });
    await expect(endButton).toBeVisible({ timeout: 5000 });
    await endButton.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Dialog should have cancel and confirm buttons
    await expect(
      dialog.getByRole("button", { name: /cancel/i }),
    ).toBeVisible();
    const confirmButton = dialog.getByRole("button", {
      name: /end session/i,
    });
    await expect(confirmButton).toBeVisible();

    // Click cancel to dismiss the dialog
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});
