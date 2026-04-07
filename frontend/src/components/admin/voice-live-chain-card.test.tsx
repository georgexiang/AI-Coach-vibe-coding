import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { VoiceLiveInstance } from "@/types/voice-live";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key} (${opts.count})`;
      return key;
    },
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/components/admin/voice-live-model-select", () => ({
  VOICE_LIVE_MODEL_OPTIONS: [
    { value: "gpt-4o", i18nKey: "modelGpt4o", tier: "pro" },
    { value: "gpt-realtime", i18nKey: "modelGptRealtime", tier: "pro" },
  ],
}));

vi.mock("@/data/avatar-characters", () => {
  const charMeta = {
    id: "lisa",
    displayName: "Lisa",
    gender: "female",
    isPhotoAvatar: false,
    styles: ["casual"],
    defaultStyle: "casual",
    thumbnailUrl: "https://example.com/lisa.png",
    gradientClasses: "from-blue-500 to-purple-600",
  };
  return {
    AVATAR_CHARACTER_MAP: new Map([["lisa", charMeta]]),
    getAvatarInitials: (name: string) => name.charAt(0).toUpperCase(),
  };
});

// Import after mocks
import { VoiceLiveInstanceCard, type AssignedHcp } from "./voice-live-chain-card";

function makeInstance(overrides: Partial<VoiceLiveInstance> = {}): VoiceLiveInstance {
  return {
    id: "inst-001",
    name: "Test Voice Config",
    description: "A test VL instance",
    voice_live_model: "gpt-4o",
    enabled: true,
    voice_name: "en-US-AvaNeural",
    voice_type: "azure-standard",
    voice_temperature: 0.9,
    voice_custom: false,
    avatar_character: "lisa",
    avatar_style: "casual",
    avatar_customized: false,
    turn_detection_type: "server_vad",
    noise_suppression: false,
    echo_cancellation: false,
    eou_detection: false,
    recognition_language: "auto",
    model_instruction: "",
    response_temperature: 0.8,
    proactive_engagement: true,
    auto_detect_language: true,
    playback_speed: 1.0,
    custom_lexicon_enabled: false,
    custom_lexicon_url: "",
    avatar_enabled: true,
    hcp_count: 2,
    created_by: "admin-001",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

describe("VoiceLiveInstanceCard", () => {
  const defaultHandlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onAssign: vi.fn(),
    onUnassign: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders instance name", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance()}
        {...defaultHandlers}
      />,
    );
    expect(screen.getByText("Test Voice Config")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ description: "My description" })}
        {...defaultHandlers}
      />,
    );
    expect(screen.getByText("My description")).toBeInTheDocument();
  });

  it("does not render description when empty", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ description: "" })}
        {...defaultHandlers}
      />,
    );
    expect(screen.queryByText("My description")).not.toBeInTheDocument();
  });

  it("shows enabled badge when instance is enabled", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ enabled: true })}
        {...defaultHandlers}
      />,
    );
    expect(screen.getByText("voiceLive.instanceEnabled")).toBeInTheDocument();
  });

  it("shows disabled badge when instance is disabled", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ enabled: false })}
        {...defaultHandlers}
      />,
    );
    expect(screen.getByText("voiceLive.statusDisabled")).toBeInTheDocument();
  });

  it("shows model label from options lookup", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ voice_live_model: "gpt-4o" })}
        {...defaultHandlers}
      />,
    );
    // The model label is retrieved via t(`hcp.${option.i18nKey}`) = "hcp.modelGpt4o"
    expect(screen.getByText("hcp.modelGpt4o")).toBeInTheDocument();
  });

  it("shows raw model ID when not found in options", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ voice_live_model: "unknown-model" })}
        {...defaultHandlers}
      />,
    );
    expect(screen.getByText("unknown-model")).toBeInTheDocument();
  });

  it("shows voice name", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ voice_name: "en-US-JennyNeural" })}
        {...defaultHandlers}
      />,
    );
    expect(screen.getByText("en-US-JennyNeural")).toBeInTheDocument();
  });

  it("shows avatar character and style", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({
          avatar_character: "lisa",
          avatar_style: "casual",
        })}
        {...defaultHandlers}
      />,
    );
    expect(screen.getByText("lisa - casual")).toBeInTheDocument();
  });

  it("shows HCP count text for instances with assigned HCPs", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ hcp_count: 3 })}
        {...defaultHandlers}
      />,
    );
    expect(
      screen.getByText("voiceLive.instanceHcpCount (3)"),
    ).toBeInTheDocument();
  });

  it("shows no-HCP text for instances with 0 assigned HCPs", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ hcp_count: 0 })}
        {...defaultHandlers}
      />,
    );
    expect(screen.getByText("voiceLive.instanceNoHcps")).toBeInTheDocument();
  });

  it("calls onEdit when edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const instance = makeInstance();
    render(
      <VoiceLiveInstanceCard
        instance={instance}
        {...defaultHandlers}
        onEdit={onEdit}
      />,
    );
    await user.click(screen.getByText("voiceLive.editInstance"));
    expect(onEdit).toHaveBeenCalledWith(instance);
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const instance = makeInstance();
    render(
      <VoiceLiveInstanceCard
        instance={instance}
        {...defaultHandlers}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByText("voiceLive.deleteInstance"));
    expect(onDelete).toHaveBeenCalledWith(instance);
  });

  it("calls onAssign when assign button is clicked", async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();
    const instance = makeInstance();
    render(
      <VoiceLiveInstanceCard
        instance={instance}
        {...defaultHandlers}
        onAssign={onAssign}
      />,
    );
    await user.click(screen.getByText("voiceLive.assignToHcp"));
    expect(onAssign).toHaveBeenCalledWith(instance);
  });

  it("does not show assign button when onAssign is not provided", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText("voiceLive.assignToHcp")).not.toBeInTheDocument();
  });

  it("expands assigned HCP list when clicked", async () => {
    const user = userEvent.setup();
    const assignedHcps: AssignedHcp[] = [
      { id: "hcp-1", name: "Dr. Alpha" },
      { id: "hcp-2", name: "Dr. Beta" },
    ];
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ hcp_count: 2 })}
        assignedHcps={assignedHcps}
        {...defaultHandlers}
      />,
    );

    // Click the HCP count button to expand
    await user.click(screen.getByText("voiceLive.instanceHcpCount (2)"));

    expect(screen.getByText("Dr. Alpha")).toBeInTheDocument();
    expect(screen.getByText("Dr. Beta")).toBeInTheDocument();
  });

  it("collapses assigned HCP list when clicked again", async () => {
    const user = userEvent.setup();
    const assignedHcps: AssignedHcp[] = [
      { id: "hcp-1", name: "Dr. Alpha" },
    ];
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ hcp_count: 1 })}
        assignedHcps={assignedHcps}
        {...defaultHandlers}
      />,
    );

    // Click to expand, then click to collapse
    const countBtn = screen.getByText("voiceLive.instanceHcpCount (1)");
    await user.click(countBtn);
    expect(screen.getByText("Dr. Alpha")).toBeInTheDocument();

    await user.click(countBtn);
    expect(screen.queryByText("Dr. Alpha")).not.toBeInTheDocument();
  });

  it("calls onUnassign when unassign button is clicked", async () => {
    const user = userEvent.setup();
    const onUnassign = vi.fn();
    const assignedHcps: AssignedHcp[] = [
      { id: "hcp-1", name: "Dr. Alpha" },
    ];
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ hcp_count: 1 })}
        assignedHcps={assignedHcps}
        {...defaultHandlers}
        onUnassign={onUnassign}
      />,
    );

    // Expand the list
    await user.click(screen.getByText("voiceLive.instanceHcpCount (1)"));

    // Click the unassign (X) button
    const unassignBtn = screen.getByTitle("voiceLive.removeInstance");
    await user.click(unassignBtn);
    expect(onUnassign).toHaveBeenCalledWith("hcp-1");
  });

  it("renders avatar thumbnail for known character", () => {
    const { container } = render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ avatar_character: "lisa", avatar_style: "casual" })}
        {...defaultHandlers}
      />,
    );
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute("alt")).toBe("Lisa");
  });

  it("renders fallback initials for unknown character", () => {
    render(
      <VoiceLiveInstanceCard
        instance={makeInstance({ avatar_character: "unknown_char" })}
        {...defaultHandlers}
      />,
    );
    // Should show first character uppercase
    expect(screen.getByText("U")).toBeInTheDocument();
  });
});
