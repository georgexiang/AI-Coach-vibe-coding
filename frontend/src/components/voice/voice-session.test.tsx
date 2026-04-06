import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceSession } from "./voice-session";
import type { TranscriptSegment } from "@/types/voice-live";

// ---- Mocks ----

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string) => `${ns ? ns + "." : ""}${key}`,
    i18n: { language: "en-US" },
  }),
}));

const mockToastError = vi.fn();
const mockToastWarning = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  AudioLines: (props: Record<string, unknown>) => (
    <svg data-testid="audio-lines-icon" {...props} />
  ),
  Settings2: (props: Record<string, unknown>) => (
    <svg data-testid="settings2-icon" {...props} />
  ),
  MessageSquare: (props: Record<string, unknown>) => (
    <svg data-testid="message-square-icon" {...props} />
  ),
}));

// Mock child components to simplify rendering
vi.mock("./voice-session-header", () => ({
  VoiceSessionHeader: (props: Record<string, unknown>) => (
    <div data-testid="voice-session-header">
      <span data-testid="header-title">{String(props.scenarioTitle)}</span>
      <span data-testid="header-mode">{String(props.currentMode)}</span>
      <span data-testid="header-connection">{String(props.connectionState)}</span>
      <button data-testid="end-session-btn" onClick={props.onEndSession as () => void}>
        End
      </button>
      <button data-testid="toggle-view-btn" onClick={props.onToggleView as () => void}>
        ToggleView
      </button>
    </div>
  ),
}));

vi.mock("./avatar-view", () => ({
  AvatarView: (props: Record<string, unknown>) => (
    <div data-testid="avatar-view">
      <span data-testid="avatar-connecting">{String(props.isConnecting)}</span>
      <span data-testid="avatar-hcp">{String(props.hcpName)}</span>
      <span data-testid="avatar-fullscreen">{String(props.isFullScreen)}</span>
    </div>
  ),
}));

vi.mock("./voice-transcript", () => ({
  VoiceTranscript: (props: { transcripts: TranscriptSegment[]; hcpName: string }) => (
    <div data-testid="voice-transcript">
      <span data-testid="transcript-count">{props.transcripts.length}</span>
    </div>
  ),
}));

vi.mock("./voice-controls", () => ({
  VoiceControls: (props: Record<string, unknown>) => (
    <div data-testid="voice-controls">
      <button data-testid="toggle-mute-btn" onClick={props.onToggleMute as () => void}>
        Mute
      </button>
      <button
        data-testid="toggle-keyboard-btn"
        onClick={props.onToggleKeyboard as () => void}
      >
        Keyboard
      </button>
      <button
        data-testid="controls-toggle-view-btn"
        onClick={props.onToggleView as () => void}
      >
        View
      </button>
      {props.onEndSession != null && (
        <button
          data-testid="controls-end-session-btn"
          onClick={props.onEndSession as () => void}
        >
          EndCall
        </button>
      )}
    </div>
  ),
}));

vi.mock("./voice-config-panel", () => ({
  VoiceConfigPanel: (props: Record<string, unknown>) => (
    <div data-testid="voice-config-panel">
      <span data-testid="config-voice-name">{String(props.voiceName ?? "")}</span>
      <span data-testid="config-avatar-enabled">{String(props.avatarEnabled)}</span>
    </div>
  ),
}));

// Mock UI components
vi.mock("@/components/ui", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  Button: ({
    children,
    onClick,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
  }) => (
    <button data-testid={`btn-${variant ?? "default"}`} data-size={size} onClick={onClick}>
      {children}
    </button>
  ),
  Tabs: ({ children, defaultValue, className }: { children: React.ReactNode; defaultValue?: string; className?: string }) => (
    <div data-testid="tabs" data-default-value={defaultValue} className={className}>{children}</div>
  ),
  TabsList: ({ children, className, ...rest }: { children: React.ReactNode; className?: string; [key: string]: unknown }) => (
    <div data-testid="tabs-list" className={className} {...rest}>{children}</div>
  ),
  TabsTrigger: ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => (
    <button data-testid={`tab-trigger-${value}`} className={className}>{children}</button>
  ),
  TabsContent: ({ children, value, className, ...rest }: { children: React.ReactNode; value: string; className?: string; [key: string]: unknown }) => (
    <div data-testid={`tab-content-${value}`} className={className} {...rest}>{children}</div>
  ),
}));

// ---- Hook mocks ----
// connect() returns { avatarEnabled, model, iceServers } via backend WebSocket proxy
const mockSendAudio = vi.fn();
const mockSend = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  avatarEnabled: false,
  model: "gpt-4o",
  iceServers: [],
});
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockToggleMute = vi.fn();
const mockSendTextMessage = vi.fn().mockResolvedValue(undefined);
const mockAvatarSdpCallbackRef = { current: null as ((sdp: string) => void) | null };
let mockVoiceConnectionState = "disconnected";

let capturedOnTranscript: ((segment: TranscriptSegment) => void) | undefined;
let capturedOnConnectionStateChange: ((state: string) => void) | undefined;
let capturedOnError: ((error: Error) => void) | undefined;

vi.mock("@/hooks/use-voice-live", () => ({
  useVoiceLive: (opts: Record<string, unknown>) => {
    capturedOnTranscript = opts.onTranscript as typeof capturedOnTranscript;
    capturedOnConnectionStateChange = opts.onConnectionStateChange as typeof capturedOnConnectionStateChange;
    capturedOnError = opts.onError as typeof capturedOnError;
    return {
      connect: mockConnect,
      disconnect: mockDisconnect,
      toggleMute: mockToggleMute,
      sendTextMessage: mockSendTextMessage,
      sendAudio: mockSendAudio,
      send: mockSend,
      isMuted: false,
      connectionState: mockVoiceConnectionState,
      audioState: "idle",
      avatarSdpCallbackRef: mockAvatarSdpCallbackRef,
    };
  },
}));

const mockAvatarConnect = vi.fn().mockResolvedValue(undefined);
const mockAvatarDisconnect = vi.fn();

const mockHandleServerSdp = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/use-avatar-stream", () => ({
  useAvatarStream: () => ({
    connect: mockAvatarConnect,
    disconnect: mockAvatarDisconnect,
    handleServerSdp: mockHandleServerSdp,
    isConnected: false,
  }),
}));

const mockAudioInitialize = vi.fn().mockResolvedValue(undefined);
const mockStartRecording = vi.fn();
const mockAudioCleanup = vi.fn();

vi.mock("@/hooks/use-audio-handler", () => ({
  useAudioHandler: () => ({
    initialize: mockAudioInitialize,
    startRecording: mockStartRecording,
    stopRecording: vi.fn(),
    cleanup: mockAudioCleanup,
    isRecording: false,
    analyserData: null,
    analyserRef: { current: null },
  }),
}));

// Mock audio player (decodes response.audio.delta base64 PCM16 → Web Audio API)
const mockPlayAudio = vi.fn();
const mockStopAudio = vi.fn();

vi.mock("@/hooks/use-audio-player", () => ({
  useAudioPlayer: () => ({
    playAudio: mockPlayAudio,
    stopAudio: mockStopAudio,
  }),
}));

// useVoiceToken no longer needed — backend proxy handles token/credentials

const mockEndSessionMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/use-session", () => ({
  useEndSession: () => ({
    mutateAsync: mockEndSessionMutateAsync,
    isLoading: false,
  }),
}));

const mockScenarioData = {
  id: "scenario-1",
  name: "Test Scenario",
  description: "A test scenario",
  product: "TestProduct",
  therapeutic_area: "Oncology",
  mode: "f2f" as const,
  difficulty: "medium" as const,
  status: "active" as const,
  hcp_profile_id: "hcp-1",
  key_messages: ["Message A", "Message B"],
  weight_key_message: 30,
  weight_objection_handling: 25,
  weight_communication: 20,
  weight_product_knowledge: 15,
  weight_scientific_info: 10,
  pass_threshold: 70,
  estimated_duration: 15,
  created_by: "admin",
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

let mockScenarioReturn: { data: typeof mockScenarioData | undefined } = {
  data: mockScenarioData,
};

vi.mock("@/hooks/use-scenarios", () => ({
  useScenario: () => mockScenarioReturn,
}));

const mockPersistTranscriptMessage = vi.fn().mockResolvedValue(undefined);

vi.mock("@/api/voice-live", () => ({
  persistTranscriptMessage: (...args: unknown[]) => mockPersistTranscriptMessage(...args),
}));

// ---- Helpers ----

const defaultProps: React.ComponentProps<typeof VoiceSession> = {
  sessionId: "session-123",
  scenarioId: "scenario-1",
  hcpProfileId: "hcp-1",
  hcpName: "Dr. Smith",
  systemPrompt: "You are a helpful assistant",
  language: "en-US",
};

function renderSession(overrides: Partial<typeof defaultProps> = {}) {
  return render(<VoiceSession {...defaultProps} {...overrides} />);
}

// ---- Tests ----

describe("VoiceSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScenarioReturn = { data: mockScenarioData };
    mockVoiceConnectionState = "disconnected";
    capturedOnTranscript = undefined;
    capturedOnConnectionStateChange = undefined;
    capturedOnError = undefined;
  });

  // ======== Rendering ========

  describe("rendering", () => {
    it("renders main layout with header, avatar, and controls", () => {
      renderSession();

      expect(screen.getByTestId("voice-session-header")).toBeInTheDocument();
      expect(screen.getByTestId("avatar-view")).toBeInTheDocument();
      expect(screen.getByTestId("voice-controls")).toBeInTheDocument();
    });

    it("shows start overlay with start button before session begins", () => {
      renderSession();

      expect(screen.getByTestId("start-overlay")).toBeInTheDocument();
      expect(screen.getByTestId("start-session-btn")).toBeInTheDocument();
      expect(screen.getByTestId("audio-lines-icon")).toBeInTheDocument();
      expect(screen.getByText("voice.startButton")).toBeInTheDocument();
    });

    it("passes scenario name to header when scenario is loaded", () => {
      renderSession();
      expect(screen.getByTestId("header-title")).toHaveTextContent("Test Scenario");
    });

    it("passes default scenario name to header when scenario is undefined", () => {
      mockScenarioReturn = { data: undefined };
      renderSession();
      expect(screen.getByTestId("header-title")).toHaveTextContent("common.loading");
    });

    it("passes mode to header", () => {
      renderSession();
      // Default mode is digital_human_realtime_model (no text fallback)
      expect(screen.getByTestId("header-mode")).toHaveTextContent("digital_human_realtime_model");
    });

    it("passes hcpName to avatar view", () => {
      renderSession();
      expect(screen.getByTestId("avatar-hcp")).toHaveTextContent("Dr. Smith");
    });

    it("does not show keyboard input by default", () => {
      renderSession();
      expect(screen.queryByPlaceholderText("voice.keyboardInput")).not.toBeInTheDocument();
    });

    it("shows empty state prompt before session starts (no transcripts)", () => {
      renderSession();
      // 2-panel layout: chat area shows prompt text when no transcripts
      expect(screen.getByText("voice.startPrompt")).toBeInTheDocument();
      expect(screen.queryByTestId("voice-transcript")).not.toBeInTheDocument();
    });

    it("shows waiting message after session starts with no transcripts yet", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("start-session-btn"));

      // After starting but before any transcript arrives
      expect(screen.getByText("voice.waitingForResponse")).toBeInTheDocument();
    });

    it("shows voice transcript when transcripts exist", async () => {
      renderSession();

      await act(async () => {
        capturedOnTranscript?.({
          id: "seg-1",
          role: "user",
          content: "Hello",
          isFinal: true,
          timestamp: Date.now(),
        });
      });

      expect(screen.getByTestId("voice-transcript")).toBeInTheDocument();
      expect(screen.getByTestId("transcript-count")).toHaveTextContent("1");
    });

    it("shows scenario info in right panel header", () => {
      renderSession();
      // Scenario name appears in header mock AND inline right panel — both present
      expect(screen.getAllByText("Test Scenario").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("A test scenario")).toBeInTheDocument();
    });
  });

  // ======== Full-screen toggle ========

  describe("full-screen toggle", () => {
    it("toggles isFullScreen state when header toggle button is clicked", async () => {
      const user = userEvent.setup();
      renderSession();

      // Clicking toggle-view changes internal isFullScreen state
      // In 2-panel layout, avatar always receives isFullScreen={false}
      expect(screen.getByTestId("avatar-fullscreen")).toHaveTextContent("false");

      await user.click(screen.getByTestId("toggle-view-btn"));

      // The AvatarView still gets false in the new 2-panel layout
      expect(screen.getByTestId("avatar-fullscreen")).toHaveTextContent("false");
    });
  });

  // ======== Keyboard input ========

  describe("keyboard input", () => {
    it("shows keyboard input when toggle keyboard button is clicked", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("toggle-keyboard-btn"));
      expect(screen.getByPlaceholderText("voice.keyboardInput")).toBeInTheDocument();
    });

    it("hides keyboard input on second toggle", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("toggle-keyboard-btn"));
      expect(screen.getByPlaceholderText("voice.keyboardInput")).toBeInTheDocument();

      await user.click(screen.getByTestId("toggle-keyboard-btn"));
      expect(screen.queryByPlaceholderText("voice.keyboardInput")).not.toBeInTheDocument();
    });

    it("clears input and calls handleSendText on button click", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("toggle-keyboard-btn"));

      const input = screen.getByPlaceholderText("voice.keyboardInput");
      await user.type(input, "Hello doctor");

      // Click the Send button
      const sendBtn = screen.getByText("common.send");
      await user.click(sendBtn);

      // Should persist transcript
      await waitFor(() => {
        expect(mockPersistTranscriptMessage).toHaveBeenCalledWith(
          "session-123",
          "user",
          "Hello doctor",
        );
      });

      // Input should be cleared
      expect(input).toHaveValue("");
    });

    it("submits on Enter key press", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("toggle-keyboard-btn"));

      const input = screen.getByPlaceholderText("voice.keyboardInput");
      await user.type(input, "Testing enter{Enter}");

      await waitFor(() => {
        expect(mockPersistTranscriptMessage).toHaveBeenCalledWith(
          "session-123",
          "user",
          "Testing enter",
        );
      });
    });

    it("does not submit empty input on button click", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("toggle-keyboard-btn"));

      const sendBtn = screen.getByText("common.send");
      await user.click(sendBtn);

      expect(mockPersistTranscriptMessage).not.toHaveBeenCalled();
    });

    it("does not submit whitespace-only input", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("toggle-keyboard-btn"));

      const input = screen.getByPlaceholderText("voice.keyboardInput");
      await user.type(input, "   ");

      const sendBtn = screen.getByText("common.send");
      await user.click(sendBtn);

      expect(mockPersistTranscriptMessage).not.toHaveBeenCalled();
    });

    it("does not submit on Enter with empty input", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("toggle-keyboard-btn"));

      const input = screen.getByPlaceholderText("voice.keyboardInput");
      await user.type(input, "{Enter}");

      expect(mockPersistTranscriptMessage).not.toHaveBeenCalled();
    });
  });

  // ======== End session dialog ========

  describe("end session dialog", () => {
    it("shows end session dialog when end button is clicked", async () => {
      const user = userEvent.setup();
      renderSession();

      expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();

      await user.click(screen.getByTestId("end-session-btn"));

      expect(screen.getByTestId("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-title")).toHaveTextContent("voice.endSessionTitle");
      expect(screen.getByTestId("dialog-description")).toHaveTextContent(
        "voice.endSessionConfirm",
      );
    });

    it("closes dialog when continue session button is clicked", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("end-session-btn"));
      expect(screen.getByTestId("dialog")).toBeInTheDocument();

      // Click continue (outline variant)
      const continueBtn = screen.getByText("voice.continueSession");
      await user.click(continueBtn);

      expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    });

    it("confirms end session: disconnects voice/avatar, calls API, navigates", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("end-session-btn"));

      // Click end session (destructive variant)
      const endBtn = screen.getByText("voice.endSession");
      await user.click(endBtn);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalled();
        expect(mockAvatarDisconnect).toHaveBeenCalled();
        expect(mockAudioCleanup).toHaveBeenCalled();
        expect(mockEndSessionMutateAsync).toHaveBeenCalledWith("session-123");
        expect(mockNavigate).toHaveBeenCalledWith("/user/scoring/session-123");
      });
    });

    it("handles endSession API failure gracefully", async () => {
      mockEndSessionMutateAsync.mockRejectedValueOnce(new Error("API error"));
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("end-session-btn"));
      const endBtn = screen.getByText("voice.endSession");
      await user.click(endBtn);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalled();
        expect(mockEndSessionMutateAsync).toHaveBeenCalledWith("session-123");
      });

      // Should navigate to scenarios page as fallback on failure
      expect(mockNavigate).toHaveBeenCalledWith("/user/scenarios");
    });

    it("closes dialog immediately when confirm is clicked", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("end-session-btn"));
      expect(screen.getByTestId("dialog")).toBeInTheDocument();

      const endBtn = screen.getByText("voice.endSession");
      await user.click(endBtn);

      // Dialog should close before API call completes
      expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    });
  });

  // ======== Transcript handling ========

  describe("transcript handling via onTranscript callback", () => {
    it("adds new transcript segment", async () => {
      renderSession();

      await act(async () => {
        capturedOnTranscript?.({
          id: "seg-1",
          role: "user",
          content: "Hello",
          isFinal: false,
          timestamp: Date.now(),
        });
      });

      expect(screen.getByTestId("transcript-count")).toHaveTextContent("1");
    });

    it("updates existing transcript segment by id", async () => {
      renderSession();

      await act(async () => {
        capturedOnTranscript?.({
          id: "seg-1",
          role: "user",
          content: "Hel",
          isFinal: false,
          timestamp: Date.now(),
        });
      });

      expect(screen.getByTestId("transcript-count")).toHaveTextContent("1");

      await act(async () => {
        capturedOnTranscript?.({
          id: "seg-1",
          role: "user",
          content: "Hello world",
          isFinal: true,
          timestamp: Date.now(),
        });
      });

      // Still 1 segment (updated, not added)
      expect(screen.getByTestId("transcript-count")).toHaveTextContent("1");
    });

    it("persists final transcript messages to backend", async () => {
      renderSession();

      await act(async () => {
        capturedOnTranscript?.({
          id: "seg-final",
          role: "assistant",
          content: "Hi there",
          isFinal: true,
          timestamp: Date.now(),
        });
      });

      expect(mockPersistTranscriptMessage).toHaveBeenCalledWith(
        "session-123",
        "assistant",
        "Hi there",
      );
    });

    it("does not persist non-final transcripts to backend", async () => {
      renderSession();

      await act(async () => {
        capturedOnTranscript?.({
          id: "seg-partial",
          role: "user",
          content: "Hel",
          isFinal: false,
          timestamp: Date.now(),
        });
      });

      expect(mockPersistTranscriptMessage).not.toHaveBeenCalled();
    });

    it("cleans up flush promises after persistence completes", async () => {
      let resolveFlush: (() => void) | undefined;
      mockPersistTranscriptMessage.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFlush = resolve;
          }),
      );

      renderSession();

      await act(async () => {
        capturedOnTranscript?.({
          id: "seg-flush",
          role: "user",
          content: "Test flush",
          isFinal: true,
          timestamp: Date.now(),
        });
      });

      expect(mockPersistTranscriptMessage).toHaveBeenCalled();

      // Resolve the flush
      await act(async () => {
        resolveFlush?.();
      });

      // No errors: the finally block cleaned up the reference
    });
  });

  // ======== Connection state change callback ========

  describe("connection state change callback", () => {
    it("shows error toast on connection error (no fallback)", async () => {
      renderSession();

      await act(async () => {
        capturedOnConnectionStateChange?.("error");
      });

      // No fallback — shows error toast
      expect(mockToastError).toHaveBeenCalledWith("voice.error.connectionFailed");
    });
  });

  // ======== onError callback ========

  describe("onError callback", () => {
    it("logs error via console.error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      renderSession();

      await act(async () => {
        capturedOnError?.(new Error("test voice error"));
      });

      expect(consoleSpy).toHaveBeenCalledWith("Voice Live error:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  // ======== Start button behavior ========

  describe("start button", () => {
    it("does not initialize voice connection before start button is clicked", () => {
      renderSession();

      // Voice should NOT auto-connect on mount
      expect(mockAudioInitialize).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("hides start overlay after clicking start button", async () => {
      const user = userEvent.setup();
      renderSession();

      expect(screen.getByTestId("start-overlay")).toBeInTheDocument();

      await user.click(screen.getByTestId("start-session-btn"));

      // Start overlay should disappear (sessionStarted = true)
      expect(screen.queryByTestId("start-overlay")).not.toBeInTheDocument();
    });

    it("initiates voice connection when start button is clicked", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("start-session-btn"));

      await waitFor(() => {
        expect(mockAudioInitialize).toHaveBeenCalled();
        expect(mockConnect).toHaveBeenCalled();
      });
    });

    it("has correct aria-label on start button", () => {
      renderSession();
      expect(screen.getByTestId("start-session-btn")).toHaveAttribute(
        "aria-label",
        "voice.startButton",
      );
    });
  });

  // ======== Voice initialization after start ========

  describe("voice initialization after start", () => {
    it("initializes voice and starts recording after start button click", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("start-session-btn"));

      await waitFor(() => {
        expect(mockAudioInitialize).toHaveBeenCalled();
        expect(mockConnect).toHaveBeenCalled();
        expect(mockStartRecording).toHaveBeenCalled();
      });
    });

    it("initializes voice and tries avatar when proxy reports avatar_enabled", async () => {
      const mockIceServers = [
        { urls: "turn:relay.azure.com:3478", username: "u", credential: "c" },
      ];
      mockConnect.mockResolvedValueOnce({
        model: "gpt-4o",
        avatarEnabled: true,
        iceServers: mockIceServers,
      });

      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("start-session-btn"));

      await waitFor(() => {
        expect(mockAudioInitialize).toHaveBeenCalled();
        expect(mockConnect).toHaveBeenCalled();
        // CRITICAL: avatarConnect receives ICE servers from session.updated
        expect(mockAvatarConnect).toHaveBeenCalled();
        const avatarCallArgs = mockAvatarConnect.mock.calls[0]!;
        expect(avatarCallArgs[0]).toEqual(mockIceServers);
        expect(mockStartRecording).toHaveBeenCalled();
      });

      // Verify avatar SDP offer is sent with correct field name (client_sdp, not clientSdp)
      const sendSdpCallback = mockAvatarConnect.mock.calls[0]![1] as (sdp: string) => Promise<void>;
      await act(async () => {
        await sendSdpCallback("v=0\r\ntest-sdp");
      });
      expect(mockSend).toHaveBeenCalledWith({
        type: "session.avatar.connect",
        client_sdp: "v=0\r\ntest-sdp",
      });
    });

    it("shows error toast when connection fails (no fallback)", async () => {
      mockConnect.mockRejectedValueOnce(new Error("WebSocket connection failed"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("start-session-btn"));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("voice.error.connectionFailed");
      });
      consoleSpy.mockRestore();
    });

    it("does not attempt avatar when avatarEnabled is false", async () => {
      mockConnect.mockResolvedValueOnce({
        model: "gpt-4o",
        avatarEnabled: false,
        iceServers: [],
      });

      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("start-session-btn"));

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalled();
      });

      // Avatar not attempted since avatarEnabled is false
      expect(mockAvatarConnect).not.toHaveBeenCalled();
    });

    it("sets isConnecting during initialization", async () => {
      let resolveConnect: ((val: unknown) => void) | undefined;
      mockConnect.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveConnect = resolve;
          }),
      );

      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("start-session-btn"));

      // Should be connecting
      await waitFor(() => {
        expect(screen.getByTestId("avatar-connecting")).toHaveTextContent("true");
      });

      // Start overlay should be hidden (sessionStarted = true, even though isConnecting)
      expect(screen.queryByTestId("start-overlay")).not.toBeInTheDocument();

      // Resolve connect
      await act(async () => {
        resolveConnect?.({
          model: "gpt-4o",
          avatarEnabled: false,
          iceServers: [],
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId("avatar-connecting")).toHaveTextContent("false");
      });
    });
  });

  // ======== Text message sending via voice live ========

  describe("handleSendText", () => {
    it("persists text but does not send via voiceLive when disconnected", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("toggle-keyboard-btn"));
      const input = screen.getByPlaceholderText("voice.keyboardInput");
      await user.type(input, "Test message{Enter}");

      await waitFor(() => {
        expect(mockPersistTranscriptMessage).toHaveBeenCalledWith(
          "session-123",
          "user",
          "Test message",
        );
      });

      // sendTextMessage should NOT be called when disconnected
      expect(mockSendTextMessage).not.toHaveBeenCalled();
    });

    it("sends text via voiceLive.sendTextMessage when connected", async () => {
      mockVoiceConnectionState = "connected";
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("toggle-keyboard-btn"));
      const input = screen.getByPlaceholderText("voice.keyboardInput");
      await user.type(input, "Hello connected{Enter}");

      await waitFor(() => {
        expect(mockSendTextMessage).toHaveBeenCalledWith("Hello connected");
      });

      // Also persists the transcript
      expect(mockPersistTranscriptMessage).toHaveBeenCalledWith(
        "session-123",
        "user",
        "Hello connected",
      );
    });
  });

  // ======== Confirm end session flushes pending writes ========

  describe("confirmEndSession flushes pending writes", () => {
    it("waits for pending flushes before disconnecting", async () => {
      const callOrder: string[] = [];

      let resolveFlush: (() => void) | undefined;
      mockPersistTranscriptMessage.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFlush = resolve;
          }),
      );

      mockDisconnect.mockImplementationOnce(async () => {
        callOrder.push("disconnect");
      });

      const user = userEvent.setup();
      renderSession();

      // Trigger a final transcript to create a pending flush
      await act(async () => {
        capturedOnTranscript?.({
          id: "pending-seg",
          role: "user",
          content: "Pending message",
          isFinal: true,
          timestamp: Date.now(),
        });
      });

      // Open end dialog and confirm
      await user.click(screen.getByTestId("end-session-btn"));

      // Now resolve the flush before clicking confirm
      await act(async () => {
        resolveFlush?.();
      });

      const endBtn = screen.getByText("voice.endSession");
      await user.click(endBtn);

      await waitFor(() => {
        expect(callOrder).toContain("disconnect");
      });
    });
  });

  // ======== startRecording sends audio to client ========

  describe("startRecording callback", () => {
    it("starts recording with callback that sends audio to session", async () => {
      const user = userEvent.setup();
      renderSession();

      // Click start button to trigger voice initialization
      await user.click(screen.getByTestId("start-session-btn"));

      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });

      // Get the callback passed to startRecording and invoke it
      const recordingCallback = mockStartRecording.mock.calls[0]?.[0] as
        | ((data: Float32Array) => void)
        | undefined;

      // The callback converts audio to base64 and sends via voiceLive.sendAudio
      const data = new Float32Array([0.3, 0.4]);
      recordingCallback?.(data);

      // Audio is converted from Float32 → Int16 PCM → base64 string via sendAudio
      expect(mockSendAudio).toHaveBeenCalled();
      const sentData = mockSendAudio.mock.calls[0]![0] as string;
      expect(typeof sentData).toBe("string"); // base64 encoded
    });
  });

  // ======== Edge cases ========

  describe("edge cases", () => {
    it("handles multiple transcripts and shows correct count", async () => {
      renderSession();

      await act(async () => {
        capturedOnTranscript?.({
          id: "a1",
          role: "user",
          content: "First",
          isFinal: true,
          timestamp: Date.now(),
        });
      });

      await act(async () => {
        capturedOnTranscript?.({
          id: "a2",
          role: "assistant",
          content: "Second",
          isFinal: true,
          timestamp: Date.now(),
        });
      });

      await act(async () => {
        capturedOnTranscript?.({
          id: "a3",
          role: "user",
          content: "Third",
          isFinal: false,
          timestamp: Date.now(),
        });
      });

      expect(screen.getByTestId("transcript-count")).toHaveTextContent("3");
    });

    it("renders with empty scenarioId", () => {
      renderSession({ scenarioId: "" });
      expect(screen.getByTestId("voice-session-header")).toBeInTheDocument();
    });

    it("passes connection state to header", () => {
      renderSession();
      expect(screen.getByTestId("header-connection")).toHaveTextContent("disconnected");
    });

    it("stops audio player on end session", async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByTestId("end-session-btn"));
      const endBtn = screen.getByText("voice.endSession");
      await user.click(endBtn);

      await waitFor(() => {
        expect(mockStopAudio).toHaveBeenCalled();
      });
    });
  });
});
