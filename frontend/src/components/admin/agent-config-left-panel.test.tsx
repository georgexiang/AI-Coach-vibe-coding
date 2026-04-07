import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, FormProvider } from "react-hook-form";
import type { VoiceLiveInstance } from "@/types/voice-live";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";

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

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
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
  model_instruction: "",
  response_temperature: 0.8,
  proactive_engagement: true,
  auto_detect_language: true,
  playback_speed: 1.0,
  custom_lexicon_enabled: false,
  custom_lexicon_url: "",
  avatar_enabled: true,
  hcp_count: 0,
  created_by: "admin-001",
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

let mockInstances: VoiceLiveInstance[] = [MOCK_INSTANCE];
const mockAssignMutate = vi.fn();
const mockUnassignMutate = vi.fn();

vi.mock("@/hooks/use-voice-live-instances", () => ({
  useVoiceLiveInstances: () => ({
    data: { items: mockInstances, total: mockInstances.length },
    isLoading: false,
  }),
  useAssignVoiceLiveInstance: () => ({
    mutate: mockAssignMutate,
    isPending: false,
  }),
  useUnassignVoiceLiveInstance: () => ({
    mutate: mockUnassignMutate,
    isPending: false,
  }),
}));

vi.mock("@/components/admin/voice-live-model-select", () => ({
  VoiceLiveModelSelect: ({ value }: { value: string }) => (
    <div data-testid="model-select">{value}</div>
  ),
}));

let capturedInstructionsProps: Record<string, unknown> | null = null;
vi.mock("@/components/admin/instructions-section", () => ({
  InstructionsSection: (props: Record<string, unknown>) => {
    capturedInstructionsProps = props;
    return <div data-testid="instructions-section">InstructionsSection</div>;
  },
}));

// Import after mocks
import { AgentConfigLeftPanel } from "./agent-config-left-panel";

function TestWrapper({
  instanceId = null,
  isNew = false,
  voiceModeEnabled = false,
  profile,
  onVoiceModeChange,
  onAutoInstructionsChange,
}: {
  instanceId?: string | null;
  isNew?: boolean;
  voiceModeEnabled?: boolean;
  profile?: { id: string; name: string };
  onVoiceModeChange?: (enabled: boolean) => void;
  onAutoInstructionsChange?: (instructions: string) => void;
}) {
  const form = useForm<HcpFormValues>({
    defaultValues: {
      name: "Dr. Test",
      specialty: "Oncology",
      hospital: "",
      title: "",
      personality_type: "friendly",
      emotional_state: 50,
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
      voice_name: "",
      voice_type: "",
      voice_temperature: 0.9,
      voice_custom: false,
      avatar_character: "",
      avatar_style: "",
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
      <AgentConfigLeftPanel
        form={form}
        profile={profile as never}
        isNew={isNew}
        voiceModeEnabled={voiceModeEnabled}
        onVoiceModeChange={onVoiceModeChange ?? vi.fn()}
        onAutoInstructionsChange={onAutoInstructionsChange}
      />
    </FormProvider>
  );
}

describe("AgentConfigLeftPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedInstructionsProps = null;
    mockInstances = [MOCK_INSTANCE];
  });

  // ── Rendering ───────────────────────────────────────────────
  it("renders model deployment section", () => {
    render(<TestWrapper />);
    expect(screen.getByText("admin:hcp.modelDeployment")).toBeInTheDocument();
    expect(screen.getByTestId("model-select")).toBeInTheDocument();
  });

  it("renders voice mode toggle", () => {
    render(<TestWrapper />);
    expect(screen.getByText("admin:hcp.voiceModeToggle")).toBeInTheDocument();
    expect(screen.getByText("admin:hcp.voiceModeDescription")).toBeInTheDocument();
  });

  it("renders instructions section", () => {
    render(<TestWrapper />);
    expect(screen.getByTestId("instructions-section")).toBeInTheDocument();
  });

  it("renders knowledge & tools section", () => {
    render(<TestWrapper />);
    expect(screen.getByText("admin:hcp.knowledgeAndTools")).toBeInTheDocument();
  });

  // ── Voice Mode Toggle ──────────────────────────────────────
  it("calls onVoiceModeChange when toggle is clicked", async () => {
    const user = userEvent.setup();
    const onVoiceModeChange = vi.fn();
    render(
      <TestWrapper
        voiceModeEnabled={false}
        onVoiceModeChange={onVoiceModeChange}
      />,
    );
    const toggle = screen.getByRole("switch", {
      name: "admin:hcp.voiceModeToggle",
    });
    await user.click(toggle);
    expect(onVoiceModeChange).toHaveBeenCalledWith(true);
  });

  // ── Voice Mode enabled UI ─────────────────────────────────
  it("shows VL instance select when voice mode is enabled", () => {
    render(<TestWrapper voiceModeEnabled={true} />);
    expect(screen.getByText("admin:hcp.vlInstanceLabel")).toBeInTheDocument();
  });

  it("hides VL instance select when voice mode is disabled", () => {
    render(<TestWrapper voiceModeEnabled={false} />);
    expect(
      screen.queryByText("admin:hcp.vlInstanceLabel"),
    ).not.toBeInTheDocument();
  });

  it("shows VL management link when voice mode is enabled", () => {
    render(<TestWrapper voiceModeEnabled={true} />);
    expect(
      screen.getByText("admin:voiceLive.goToVlManagement"),
    ).toBeInTheDocument();
  });

  it("navigates to VL management when link is clicked", async () => {
    const user = userEvent.setup();
    render(<TestWrapper voiceModeEnabled={true} />);
    await user.click(screen.getByText("admin:voiceLive.goToVlManagement"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/voice-live");
  });

  // ── New profile hint ──────────────────────────────────────
  it("shows disabled hint for new profiles", () => {
    render(<TestWrapper isNew={true} />);
    expect(
      screen.getByText("admin:hcp.playgroundDisabledNew"),
    ).toBeInTheDocument();
  });

  it("does not show disabled hint for existing profiles", () => {
    render(<TestWrapper isNew={false} />);
    expect(
      screen.queryByText("admin:hcp.playgroundDisabledNew"),
    ).not.toBeInTheDocument();
  });

  // ── Remove instance button ────────────────────────────────
  it("shows remove button (X) when instance is selected", () => {
    render(
      <TestWrapper
        instanceId="inst-001"
        voiceModeEnabled={true}
      />,
    );
    expect(
      screen.getByTitle("admin:voiceLive.removeInstance"),
    ).toBeInTheDocument();
  });

  it("does not show remove button when no instance is selected", () => {
    render(
      <TestWrapper
        instanceId={null}
        voiceModeEnabled={true}
      />,
    );
    expect(
      screen.queryByTitle("admin:voiceLive.removeInstance"),
    ).not.toBeInTheDocument();
  });

  // ── Knowledge & Tools expand/collapse ─────────────────────
  it("expands knowledge & tools section when header is clicked", async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);
    // Initially collapsed — placeholders should not be visible
    expect(
      screen.queryByText("admin:hcp.knowledgePlaceholder"),
    ).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText("admin:hcp.knowledgeAndTools"));
    expect(
      screen.getByText("admin:hcp.knowledgePlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("admin:hcp.toolsPlaceholder"),
    ).toBeInTheDocument();
  });

  it("collapses knowledge & tools section when header is clicked twice", async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);
    const header = screen.getByText("admin:hcp.knowledgeAndTools");

    // Expand
    await user.click(header);
    expect(
      screen.getByText("admin:hcp.knowledgePlaceholder"),
    ).toBeInTheDocument();

    // Collapse
    await user.click(header);
    expect(
      screen.queryByText("admin:hcp.knowledgePlaceholder"),
    ).not.toBeInTheDocument();
  });

  // ── Remove Dialog ─────────────────────────────────────────
  it("shows remove confirmation dialog when X button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper
        instanceId="inst-001"
        voiceModeEnabled={true}
        profile={{ id: "hcp-1", name: "Dr. Test" }}
      />,
    );

    await user.click(screen.getByTitle("admin:voiceLive.removeInstance"));
    // Dialog has both title and button with same key, so check for multiple
    const removeTexts = screen.getAllByText("admin:voiceLive.removeInstance");
    // At least 2: the dialog title + the destructive button inside dialog
    expect(removeTexts.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("common:cancel")).toBeInTheDocument();
  });

  // ── Instructions section props ────────────────────────────
  it("passes form and profileId to InstructionsSection", () => {
    render(
      <TestWrapper
        isNew={false}
        profile={{ id: "hcp-1", name: "Dr. Test" }}
      />,
    );
    expect(capturedInstructionsProps).toBeTruthy();
    expect(capturedInstructionsProps!.profileId).toBe("hcp-1");
    expect(capturedInstructionsProps!.isNew).toBe(false);
  });
});
