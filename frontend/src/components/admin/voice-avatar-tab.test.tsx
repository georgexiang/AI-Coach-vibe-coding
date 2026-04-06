import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { VoiceLiveInstance } from "@/types/voice-live";

// ---- Mocks ----

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrParams?: string | Record<string, unknown>) => {
      if (typeof fallbackOrParams === "string") return fallbackOrParams;
      return key;
    },
    i18n: { language: "en-US" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

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

let mockInstances: VoiceLiveInstance[] = [];

vi.mock("@/hooks/use-voice-live-instances", () => ({
  useVoiceLiveInstances: () => ({
    data: { items: mockInstances, total: mockInstances.length },
    isLoading: false,
  }),
  useAssignVoiceLiveInstance: () => ({ mutate: vi.fn(), isPending: false }),
  useUnassignVoiceLiveInstance: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/components/admin/voice-live-model-select", () => ({
  VOICE_LIVE_MODEL_OPTIONS: [
    { value: "gpt-4o", i18nKey: "modelGpt4o", tier: "pro" },
  ],
}));

vi.mock("@/data/avatar-characters", () => ({
  AVATAR_CHARACTER_MAP: new Map([
    [
      "lisa",
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
  ]),
  getAvatarInitials: (name: string) => name.charAt(0).toUpperCase(),
}));

// Import after mocks
import { VoiceAvatarTab } from "./voice-avatar-tab";
import { useForm, FormProvider } from "react-hook-form";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";

/** Wrapper providing react-hook-form context */
function TestWrapper({
  instanceId = null,
  isNew = false,
}: {
  instanceId?: string | null;
  isNew?: boolean;
}) {
  const form = useForm<HcpFormValues>({
    defaultValues: {
      name: "Test HCP",
      specialty: "Oncology",
      hospital: "",
      title: "",
      personality_type: "friendly",
      emotional_state: 30,
      communication_style: 50,
      expertise_areas: [],
      prescribing_habits: "",
      concerns: "",
      objections: [],
      probe_topics: [],
      difficulty: "medium",
      voice_live_instance_id: instanceId,
      voice_live_enabled: true,
      voice_live_model: "gpt-4o",
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
    },
  });

  return (
    <FormProvider {...form}>
      <VoiceAvatarTab form={form} isNew={isNew} />
    </FormProvider>
  );
}

describe("VoiceAvatarTab (Phase 14 read-only)", () => {
  it("shows read-only preview when instance is assigned", () => {
    // Set up mock instances list to include our instance
    mockInstances = [MOCK_INSTANCE];

    render(<TestWrapper instanceId="inst-001" />);

    // Config preview section should be visible
    expect(screen.getByText("admin:voiceLive.configPreview")).toBeInTheDocument();

    // Instance model should appear in the preview (may appear multiple times: selector + preview)
    const modelTexts = screen.getAllByText("gpt-4o");
    expect(modelTexts.length).toBeGreaterThanOrEqual(1);

    // Voice name should appear
    expect(screen.getByText("en-US-AvaNeural")).toBeInTheDocument();
  });

  it("shows empty state when no instance assigned", () => {
    mockInstances = [MOCK_INSTANCE];

    render(<TestWrapper instanceId={null} isNew={false} />);

    // Empty state text should be visible
    expect(
      screen.getByText("admin:voiceLive.noInstanceAssigned"),
    ).toBeInTheDocument();

    // Management link should be visible (appears in selector card + empty state)
    const links = screen.getAllByText("admin:voiceLive.goToVlManagement");
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render voice editing controls", () => {
    mockInstances = [MOCK_INSTANCE];

    render(<TestWrapper instanceId="inst-001" />);

    // Should NOT find temperature slider elements
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();

    // Should NOT find voice name dropdown with specific voice options
    expect(screen.queryByText("hcp.voiceAva")).not.toBeInTheDocument();
    expect(screen.queryByText("hcp.voiceAndrew")).not.toBeInTheDocument();

    // Should NOT find avatar grid
    expect(screen.queryByTestId("avatar-character-grid")).not.toBeInTheDocument();
  });

  it("renders instance selector dropdown", () => {
    mockInstances = [MOCK_INSTANCE];

    render(<TestWrapper instanceId={null} isNew={false} />);

    // Instance selector label should be visible
    expect(
      screen.getByText("admin:voiceLive.selectInstance"),
    ).toBeInTheDocument();
  });

  it("shows manage link to VL Management page", () => {
    mockInstances = [];

    render(<TestWrapper instanceId={null} isNew={false} />);

    // "Go to VL Management" link should be present
    const links = screen.getAllByText("admin:voiceLive.goToVlManagement");
    expect(links.length).toBeGreaterThanOrEqual(1);
  });
});
