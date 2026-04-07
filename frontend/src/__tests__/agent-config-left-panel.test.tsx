import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * AgentConfigLeftPanel structural tests.
 *
 * Verifies:
 * 1. Controlled voiceModeEnabled/onVoiceModeChange props (not internal state)
 * 2. Voice mode toggle drives VL Instance visibility
 * 3. VL Instance assign/unassign logic
 * 4. Component sections: Model Deployment, Voice Mode, Instructions, Knowledge & Tools
 */

const panelPath = path.resolve(
  __dirname,
  "../components/admin/agent-config-left-panel.tsx",
);
const source = fs.readFileSync(panelPath, "utf-8");

describe("AgentConfigLeftPanel: Controlled Voice Mode Props", () => {
  it("accepts voiceModeEnabled as a prop (not internal state)", () => {
    // The interface must have voiceModeEnabled as prop
    expect(source).toMatch(/voiceModeEnabled:\s*boolean/);
    // It should NOT have useState for voiceModeEnabled
    const hasInternalVoiceState = source.match(
      /useState.*voiceModeEnabled|const \[voiceModeEnabled.*useState/,
    );
    expect(hasInternalVoiceState).toBeNull();
  });

  it("accepts onVoiceModeChange callback prop", () => {
    expect(source).toMatch(
      /onVoiceModeChange:\s*\(enabled:\s*boolean\)\s*=>\s*void/,
    );
  });

  it("calls onVoiceModeChange when voice toggle changes", () => {
    expect(source).toContain("onVoiceModeChange");
    expect(source).toContain("handleVoiceModeToggle");
  });

  it("clears VL instance when voice mode is toggled off", () => {
    // handleVoiceModeToggle should clear voice_live_instance_id when disabled
    expect(source).toContain("!checked");
    expect(source).toContain(
      'form.setValue("voice_live_instance_id", null',
    );
  });
});

describe("AgentConfigLeftPanel: Voice Mode Toggle UI", () => {
  it("renders Switch component for voice mode toggle", () => {
    expect(source).toContain("<Switch");
    expect(source).toContain("voiceModeEnabled");
  });

  it("shows VL Instance selector only when voice mode is enabled", () => {
    expect(source).toContain("voiceModeEnabled && (");
  });

  it("renders remove button (X icon) when instance is selected", () => {
    expect(source).toContain("<X");
    expect(source).toContain("showRemoveDialog");
  });

  it("has link to VL Management page", () => {
    expect(source).toContain('navigate("/admin/voice-live")');
    expect(source).toContain("ExternalLink");
    expect(source).toContain("goToVlManagement");
  });

  it("truncates long instance names in SelectTrigger", () => {
    expect(source).toContain("truncate");
    // SelectTrigger has min-w-0 + truncate for proper text overflow
    expect(source).toContain("min-w-0");
  });

  it("truncates instance name text in SelectItem with shrink-0 badge", () => {
    // Instance name wrapped in truncate span, badge is shrink-0
    const hasNameTruncate = source.includes('className="truncate">{inst.name}');
    expect(hasNameTruncate).toBe(true);
    expect(source).toContain("shrink-0");
  });
});

describe("AgentConfigLeftPanel: VL Instance Logic", () => {
  it("uses assign mutation for instance selection", () => {
    expect(source).toContain("useAssignVoiceLiveInstance");
    expect(source).toContain("assignMutation.mutate");
  });

  it("uses unassign mutation for instance removal", () => {
    expect(source).toContain("useUnassignVoiceLiveInstance");
    expect(source).toContain("unassignMutation.mutate");
  });

  it("shows confirmation dialog before removing instance", () => {
    expect(source).toContain("showRemoveDialog");
    expect(source).toContain("handleConfirmRemove");
    expect(source).toContain("removeInstanceConfirm");
  });

  it("handles __none__ sentinel value for clearing selection", () => {
    expect(source).toContain('"__none__"');
  });

  it("shows toast notifications on assign/unassign success and error", () => {
    expect(source).toContain("toast.success");
    expect(source).toContain("toast.error");
    expect(source).toContain("instanceAssigned");
    expect(source).toContain("assignError");
    expect(source).toContain("removeInstanceSuccess");
  });
});

describe("AgentConfigLeftPanel: Section Layout", () => {
  it("has Model Deployment section with VoiceLiveModelSelect", () => {
    expect(source).toContain("VoiceLiveModelSelect");
    expect(source).toContain("modelDeployment");
  });

  it("has Instructions section", () => {
    expect(source).toContain("<InstructionsSection");
  });

  it("has Knowledge & Tools collapsible section", () => {
    expect(source).toContain("knowledgeAndTools");
    expect(source).toContain("knowledgeToolsExpanded");
    expect(source).toContain("ChevronDown");
    expect(source).toContain("ChevronRight");
  });

  it("Knowledge section shows placeholder text", () => {
    expect(source).toContain("knowledgePlaceholder");
    expect(source).toContain("FileText");
  });

  it("Tools section shows placeholder text", () => {
    expect(source).toContain("toolsPlaceholder");
    expect(source).toContain("Wrench");
  });

  it("disables new profile hint text", () => {
    expect(source).toContain("playgroundDisabledNew");
  });
});

describe("AgentConfigLeftPanel: Props Interface", () => {
  it("accepts form, profile, isNew, voiceModeEnabled, onVoiceModeChange", () => {
    // Check interface definition
    expect(source).toContain("AgentConfigLeftPanelProps");
    expect(source).toMatch(/form:\s*UseFormReturn/);
    expect(source).toMatch(/profile\?:\s*HcpProfile/);
    expect(source).toMatch(/isNew:\s*boolean/);
    expect(source).toMatch(/voiceModeEnabled:\s*boolean/);
    expect(source).toMatch(/onVoiceModeChange:/);
  });
});
