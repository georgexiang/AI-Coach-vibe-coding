import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * VoiceAvatarTab structural tests.
 *
 * Verifies:
 * 1. Layout uses flex with fixed-width left panel (matching VL Instance editor)
 * 2. voiceModeEnabled state is lifted up (useState in parent)
 * 3. systemPrompt fallback: override → autoInstructions (agent instructions)
 * 4. Props forwarding to AgentConfigLeftPanel and PlaygroundPreviewPanel
 * 5. VL Instance avatar data resolution
 * 6. Auto-generated instructions callback chain
 */

const tabPath = path.resolve(
  __dirname,
  "../components/admin/voice-avatar-tab.tsx",
);
const source = fs.readFileSync(tabPath, "utf-8");

describe("VoiceAvatarTab: Layout (Matching VL Instance Editor)", () => {
  it("uses flex layout for left/right panels", () => {
    expect(source).toContain("flex h-[calc(100vh-");
  });

  it("left panel has fixed 380px width matching VL editor", () => {
    expect(source).toContain("w-[380px]");
    expect(source).toContain("min-w-[340px]");
  });

  it("left panel has border-r separator", () => {
    expect(source).toContain("border-r");
  });

  it("left panel is scrollable (overflow-y-auto)", () => {
    expect(source).toContain("overflow-y-auto");
  });

  it("right panel fills remaining space (flex-1)", () => {
    expect(source).toContain("flex-1 flex flex-col min-w-0");
  });

  it("does NOT use grid layout (old approach)", () => {
    expect(source).not.toContain("grid-cols-12");
    expect(source).not.toContain("col-span-4");
    expect(source).not.toContain("col-span-8");
  });
});

describe("VoiceAvatarTab: Agent Instructions systemPrompt", () => {
  it("holds autoInstructions state for auto-generated instructions", () => {
    expect(source).toContain("autoInstructions");
    expect(source).toContain("setAutoInstructions");
  });

  it("defines handleAutoInstructionsChange callback", () => {
    expect(source).toContain("handleAutoInstructionsChange");
    expect(source).toContain("useCallback");
  });

  it("passes onAutoInstructionsChange callback to AgentConfigLeftPanel", () => {
    expect(source).toContain(
      "onAutoInstructionsChange={handleAutoInstructionsChange}",
    );
  });

  it("reads agent_instructions_override from form as override", () => {
    expect(source).toContain(
      'form.watch("agent_instructions_override")',
    );
    expect(source).toContain("overridePrompt");
  });

  it("computes systemPrompt: override if non-empty, else autoInstructions", () => {
    // The fallback logic: override takes priority, empty override falls back to auto
    expect(source).toContain("overridePrompt && overridePrompt.trim()");
    expect(source).toContain("overridePrompt : autoInstructions");
  });

  it("passes computed systemPrompt (not raw override) to PlaygroundPreviewPanel", () => {
    expect(source).toContain("systemPrompt={systemPrompt}");
    // Must NOT pass the raw form field directly
    expect(source).not.toContain(
      'systemPrompt={form.watch("agent_instructions_override")',
    );
  });

  it("does NOT pass empty string when autoInstructions are available", () => {
    // The old bug: `form.watch("agent_instructions_override") ?? ""` always empty
    // New code: falls back to autoInstructions which has the generated instructions
    const systemPromptLine = source
      .split("\n")
      .find((l) => l.includes("const systemPrompt ="));
    expect(systemPromptLine).toBeDefined();
    expect(systemPromptLine).toContain("autoInstructions");
  });
});

describe("VoiceAvatarTab: State Lifting", () => {
  it("maintains voiceModeEnabled state at tab level (useState)", () => {
    expect(source).toContain("useState");
    expect(source).toContain("voiceModeEnabled");
    expect(source).toContain("setVoiceModeEnabled");
  });

  it("initializes voiceModeEnabled from form voice_live_instance_id", () => {
    expect(source).toContain('form.getValues("voice_live_instance_id")');
  });

  it("passes voiceModeEnabled and onVoiceModeChange to AgentConfigLeftPanel", () => {
    expect(source).toContain("voiceModeEnabled={voiceModeEnabled}");
    expect(source).toContain("onVoiceModeChange={setVoiceModeEnabled}");
  });

  it("passes voiceModeEnabled to PlaygroundPreviewPanel", () => {
    expect(source).toContain("voiceModeEnabled={voiceModeEnabled}");
  });
});

describe("VoiceAvatarTab: Props Forwarding", () => {
  it("passes form, profile, isNew to AgentConfigLeftPanel", () => {
    expect(source).toContain("form={form}");
    expect(source).toContain("profile={profile}");
    expect(source).toContain("isNew={isNew}");
  });

  it("passes profile data to PlaygroundPreviewPanel", () => {
    expect(source).toContain("hcpProfileId={profile?.id}");
    expect(source).toContain("profileName={profile?.name}");
    expect(source).toContain("agentId={profile?.agent_id}");
  });

  it("derives avatar data from selected VL Instance (not HCP form)", () => {
    expect(source).toContain("selectedInstance?.avatar_character");
    expect(source).toContain("selectedInstance?.avatar_style");
    expect(source).toContain("selectedInstance?.avatar_enabled");
  });

  it("disables playground when creating new profile", () => {
    expect(source).toContain("disabled={isNew}");
  });
});

describe("VoiceAvatarTab: VL Instance Resolution", () => {
  it("imports useVoiceLiveInstances hook", () => {
    expect(source).toContain("useVoiceLiveInstances");
    expect(source).toContain('from "@/hooks/use-voice-live-instances"');
  });

  it("resolves selected VL Instance from instances list", () => {
    expect(source).toContain("selectedInstance");
    expect(source).toContain("instances.find");
  });
});

describe("VoiceAvatarTab: Component Composition", () => {
  it("imports AgentConfigLeftPanel component", () => {
    expect(source).toContain("AgentConfigLeftPanel");
    expect(source).toContain(
      'from "@/components/admin/agent-config-left-panel"',
    );
  });

  it("imports PlaygroundPreviewPanel component", () => {
    expect(source).toContain("PlaygroundPreviewPanel");
    expect(source).toContain(
      'from "@/components/admin/playground-preview-panel"',
    );
  });

  it("is a thin composition layer (~80 lines or fewer)", () => {
    const lineCount = source.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(80);
  });
});
