import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { VoiceLiveInstance } from "@/types/voice-live";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/hooks/use-voice-live-instances", () => ({
  useCreateVoiceLiveInstance: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateVoiceLiveInstance: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/components/admin/voice-live-model-select", () => ({
  VoiceLiveModelSelect: ({ value }: { value: string }) => (
    <div data-testid="model-select">{value}</div>
  ),
}));

vi.mock("@/data/avatar-characters", () => ({
  AVATAR_CHARACTERS: [
    {
      id: "lisa",
      displayName: "Lisa",
      gender: "female",
      isPhotoAvatar: false,
      styles: ["casual"],
      defaultStyle: "casual",
      thumbnailUrl: "https://example.com/lisa.png",
      gradientClasses: "from-blue-500 to-purple-600",
    },
  ],
  getAvatarInitials: (name: string) => name.charAt(0).toUpperCase(),
}));

// Import after mocks
import { VlInstanceDialog } from "./vl-instance-dialog";

const MOCK_INSTANCE: VoiceLiveInstance = {
  id: "inst-001",
  name: "Test Voice Config",
  description: "A test instance",
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
  agent_instructions_override: "",
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
};

describe("VlInstanceDialog", () => {
  it("renders create mode with empty form", () => {
    render(
      <VlInstanceDialog open={true} onOpenChange={vi.fn()} />,
    );

    // Dialog title should show create text
    expect(screen.getByText("voiceLive.vlDialogCreateTitle")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.createInstance")).toBeInTheDocument();

    // Name input should be empty
    const nameInput = screen.getByPlaceholderText("voiceLive.instanceNamePlaceholder");
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveValue("");
  });

  it("renders edit mode with pre-filled values", () => {
    render(
      <VlInstanceDialog
        open={true}
        onOpenChange={vi.fn()}
        instance={MOCK_INSTANCE}
      />,
    );

    // Dialog title should show edit text
    expect(screen.getByText("voiceLive.vlDialogEditTitle")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.editInstance")).toBeInTheDocument();

    // Name input should have the instance name
    const nameInput = screen.getByPlaceholderText("voiceLive.instanceNamePlaceholder");
    expect(nameInput).toHaveValue("Test Voice Config");
  });

  it("renders all 5 form sections", () => {
    render(
      <VlInstanceDialog open={true} onOpenChange={vi.fn()} />,
    );

    // Section headings (Model, Voice, Avatar, Conversation, Agent)
    expect(screen.getByText("voiceLive.vlDialogModelSection")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.vlDialogVoiceSection")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.vlDialogAvatarSection")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.vlDialogConversationSection")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.vlDialogAgentSection")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <VlInstanceDialog open={false} onOpenChange={vi.fn()} />,
    );

    // Dialog content should not be visible
    expect(screen.queryByText("voiceLive.vlDialogCreateTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("voiceLive.vlDialogModelSection")).not.toBeInTheDocument();
  });

  it("renders save and cancel buttons", () => {
    render(
      <VlInstanceDialog open={true} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByText("voiceLive.vlDialogSave")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.vlDialogCancel")).toBeInTheDocument();
  });
});
