import { render, screen, fireEvent } from "@testing-library/react";
import { AVATAR_CHARACTERS, AVATAR_CHARACTER_MAP, getAvatarInitials } from "@/data/avatar-characters";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/hooks/use-voice-live", () => ({
  useVoiceLive: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    toggleMute: vi.fn(),
    sendTextMessage: vi.fn(),
    sendAudio: vi.fn(),
    send: vi.fn(),
    isMuted: false,
    connectionState: "disconnected",
    audioState: "idle",
    avatarSdpCallbackRef: { current: null },
  }),
}));

vi.mock("@/hooks/use-avatar-stream", () => ({
  useAvatarStream: () => ({
    connect: vi.fn(),
    handleServerSdp: vi.fn(),
    disconnect: vi.fn(),
    isConnected: false,
  }),
}));

vi.mock("@/hooks/use-audio-handler", () => ({
  useAudioHandler: () => ({
    initialize: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cleanup: vi.fn(),
    isRecording: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));

// ---- Tests for avatar-characters data module ----

describe("avatar-characters data module", () => {
  it("contains at least 6 characters", () => {
    expect(AVATAR_CHARACTERS.length).toBeGreaterThanOrEqual(6);
  });

  it("each character has required fields", () => {
    for (const c of AVATAR_CHARACTERS) {
      expect(c.id).toBeTruthy();
      expect(c.displayName).toBeTruthy();
      expect(c.styles.length).toBeGreaterThan(0);
      expect(c.defaultStyle).toBeTruthy();
      expect(c.styles).toContain(c.defaultStyle);
      expect(c.gender).toMatch(/^(female|male)$/);
      expect(c.gradientClasses).toBeTruthy();
      expect(c.thumbnailUrl).toMatch(/^https?:\/\//);
    }
  });

  it("AVATAR_CHARACTER_MAP provides lookup by id", () => {
    expect(AVATAR_CHARACTER_MAP.get("lisa")?.displayName).toBe("Lisa");
    expect(AVATAR_CHARACTER_MAP.get("harry")?.displayName).toBe("Harry");
    expect(AVATAR_CHARACTER_MAP.get("nonexistent")).toBeUndefined();
  });

  it("getAvatarInitials returns uppercase first letter", () => {
    expect(getAvatarInitials("Lisa")).toBe("L");
    expect(getAvatarInitials("harry")).toBe("H");
    expect(getAvatarInitials("Meg")).toBe("M");
  });

  it("all character IDs are unique", () => {
    const ids = AVATAR_CHARACTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---- Tests for VoiceAvatarTab component (avatar grid section) ----

// Import after mocks are set up
import { VoiceAvatarTab } from "./voice-avatar-tab";
import { useForm, FormProvider } from "react-hook-form";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";

/** Wrapper that provides a react-hook-form context */
function TestWrapper({ defaultCharacter = "lisa" }: { defaultCharacter?: string }) {
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
      voice_live_enabled: true,
      voice_live_model: "gpt-4o",
      voice_name: "en-US-AvaNeural",
      voice_type: "azure-standard",
      voice_temperature: 0.9,
      voice_custom: false,
      avatar_character: defaultCharacter,
      avatar_style: "casual-sitting",
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
      <VoiceAvatarTab form={form} isNew={true} />
    </FormProvider>
  );
}

describe("VoiceAvatarTab avatar grid", () => {
  it("renders avatar grid with all characters", () => {
    render(<TestWrapper />);
    const grid = screen.getByTestId("avatar-character-grid");
    expect(grid).toBeInTheDocument();

    // Should have a button for each character
    for (const c of AVATAR_CHARACTERS) {
      expect(screen.getByTestId(`avatar-grid-${c.id}`)).toBeInTheDocument();
    }
  });

  it("displays character display names", () => {
    render(<TestWrapper />);
    for (const c of AVATAR_CHARACTERS) {
      // Some names may appear twice (grid + preview), so use getAllByText
      const elements = screen.getAllByText(c.displayName);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders img elements for avatar thumbnails", () => {
    render(<TestWrapper />);
    // Each character should have an img (or fallback if error already fired).
    // At least the first character should have an img initially.
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBeGreaterThan(0);
  });

  it("shows fallback initials when image fails to load", () => {
    render(<TestWrapper />);
    const lisaImg = screen.getByTestId("avatar-img-lisa");
    expect(lisaImg).toBeInTheDocument();

    // Simulate image load error
    fireEvent.error(lisaImg);

    // After error, should show fallback with initial "L"
    const fallback = screen.getByTestId("avatar-fallback-lisa");
    expect(fallback).toBeInTheDocument();
    expect(fallback.textContent).toBe("L");
  });

  it("renders style label on each character card", () => {
    render(<TestWrapper />);
    // Check that at least one default style label is visible
    expect(screen.getByText("casual sitting")).toBeInTheDocument(); // lisa's default
  });

  it("renders more avatars button", () => {
    render(<TestWrapper />);
    const moreBtn = screen.getByTestId("more-avatars-btn");
    expect(moreBtn).toBeInTheDocument();
    expect(moreBtn).toHaveTextContent("More avatars");
  });

  it("shows selection indicator on selected character", () => {
    render(<TestWrapper defaultCharacter="lisa" />);
    const lisaButton = screen.getByTestId("avatar-grid-lisa");
    // Selected character should have border-primary class
    expect(lisaButton.className).toMatch(/border-primary/);
  });

  it("grid has 3-column layout", () => {
    render(<TestWrapper />);
    const grid = screen.getByTestId("avatar-character-grid");
    expect(grid.className).toMatch(/grid-cols-3/);
  });
});
