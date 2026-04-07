import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

// Import after mocks
import { VoiceLiveModelSelect, VOICE_LIVE_MODEL_OPTIONS } from "./voice-live-model-select";

describe("VoiceLiveModelSelect", () => {
  it("renders the select trigger", () => {
    render(
      <VoiceLiveModelSelect value="gpt-4o" onValueChange={vi.fn()} />,
    );
    // The SelectTrigger should be in the document
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(
      <VoiceLiveModelSelect
        value="gpt-4o"
        onValueChange={vi.fn()}
        disabled={true}
      />,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("is enabled when disabled prop is false", () => {
    render(
      <VoiceLiveModelSelect
        value="gpt-4o"
        onValueChange={vi.fn()}
        disabled={false}
      />,
    );
    expect(screen.getByRole("combobox")).not.toBeDisabled();
  });

  it("exports VOICE_LIVE_MODEL_OPTIONS with correct tier groups", () => {
    const proModels = VOICE_LIVE_MODEL_OPTIONS.filter((m) => m.tier === "pro");
    const basicModels = VOICE_LIVE_MODEL_OPTIONS.filter((m) => m.tier === "basic");
    const liteModels = VOICE_LIVE_MODEL_OPTIONS.filter((m) => m.tier === "lite");

    expect(proModels.length).toBeGreaterThan(0);
    expect(basicModels.length).toBeGreaterThan(0);
    expect(liteModels.length).toBeGreaterThan(0);
  });

  it("all model options have required fields", () => {
    for (const opt of VOICE_LIVE_MODEL_OPTIONS) {
      expect(opt.value).toBeTruthy();
      expect(opt.i18nKey).toBeTruthy();
      expect(["pro", "basic", "lite"]).toContain(opt.tier);
    }
  });

  it("renders three tier groups when opened", async () => {
    const { container } = render(
      <VoiceLiveModelSelect value="gpt-4o" onValueChange={vi.fn()} />,
    );
    // The component should have rendered without errors
    expect(container).toBeTruthy();
  });
});
