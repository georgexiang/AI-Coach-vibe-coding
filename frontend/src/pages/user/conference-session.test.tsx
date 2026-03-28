import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConferenceSession from "./conference-session";
import type { ConferenceSSECallbacks } from "@/hooks/use-conference-sse";

const mockNavigate = vi.fn();
const mockSendMessage = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
const mockStartRecording = vi.fn();
const mockStopRecording = vi.fn();

let capturedCallbacks: ConferenceSSECallbacks = {};
let mockRecordingState = "idle";
let mockSessionData: Record<string, unknown> | undefined;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams("id=cs-1"), vi.fn()],
  };
});

vi.mock("@/hooks/use-conference", () => ({
  useConferenceSession: () => ({
    data: mockSessionData,
    isLoading: false,
  }),
  useEndConferenceSession: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-conference-sse", () => ({
  useConferenceSSE: (
    _sessionId: string,
    callbacks: ConferenceSSECallbacks,
  ) => {
    capturedCallbacks = callbacks;
    return {
      sendMessage: mockSendMessage,
      isStreaming: false,
      streamedText: "",
      abort: vi.fn(),
    };
  },
}));

vi.mock("@/hooks/use-speech", () => ({
  useSpeechInput: () => ({
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    recordingState: mockRecordingState,
    error: null,
  }),
}));

vi.mock("@/contexts/config-context", () => ({
  useConfig: () => ({
    avatar_enabled: false,
    voice_enabled: false,
    realtime_voice_enabled: false,
    conference_enabled: true,
    voice_live_enabled: false,
    default_voice_mode: "text_only",
    region: "global",
  }),
}));

vi.mock("@/components/ui", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
  }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => <button onClick={onClick}>{children}</button>,
}));

// Capture props passed to child components for verification
let capturedConferenceHeaderProps: Record<string, unknown> = {};
let capturedTopicGuideProps: Record<string, unknown> = {};
let capturedConferenceStageProps: Record<string, unknown> = {};
let capturedTranscriptionPanelProps: Record<string, unknown> = {};
let capturedAudiencePanelProps: Record<string, unknown> = {};
let capturedQuestionQueueProps: Record<string, unknown> = {};

vi.mock("@/components/conference", () => ({
  ConferenceHeader: (props: Record<string, unknown>) => {
    capturedConferenceHeaderProps = props;
    return (
      <div data-testid="conference-header">
        <button onClick={props.onEndSession as () => void}>End</button>
        <button
          onClick={() =>
            (props.onVoiceToggle as (v: boolean) => void)(true)
          }
        >
          ToggleVoice
        </button>
      </div>
    );
  },
  TopicGuide: (props: Record<string, unknown>) => {
    capturedTopicGuideProps = props;
    return (
      <div data-testid="topic-guide">
        {props.scenarioName as string}
        <button onClick={props.onToggle as () => void}>ToggleLeft</button>
      </div>
    );
  },
  ConferenceStage: (props: Record<string, unknown>) => {
    capturedConferenceStageProps = props;
    return (
      <div data-testid="conference-stage">
        <button
          onClick={() =>
            (props.onSendMessage as (text: string) => void)("Hello HCP")
          }
        >
          Send
        </button>
        <button onClick={props.onMicClick as () => void}>Mic</button>
      </div>
    );
  },
  TranscriptionPanel: (props: Record<string, unknown>) => {
    capturedTranscriptionPanelProps = props;
    return (
      <div data-testid="transcription-panel">
        <button onClick={props.onToggle as () => void}>ToggleRight</button>
      </div>
    );
  },
  AudiencePanel: (props: Record<string, unknown>) => {
    capturedAudiencePanelProps = props;
    return <div data-testid="audience-panel" />;
  },
  QuestionQueue: (props: Record<string, unknown>) => {
    capturedQuestionQueueProps = props;
    return (
      <div data-testid="question-queue">
        <button
          onClick={() =>
            (props.onRespondTo as (hcpId: string) => void)("hp-1")
          }
        >
          Respond
        </button>
      </div>
    );
  },
}));

function renderConferenceSession() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/user/conference?id=cs-1"]}>
        <ConferenceSession />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ConferenceSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordingState = "idle";
    capturedCallbacks = {};
    mockSessionData = {
      id: "cs-1",
      status: "in_progress",
      subState: "presenting",
      presentationTopic: "Drug Efficacy",
      audienceConfig: JSON.stringify([
        {
          id: "hcp-1",
          hcpProfileId: "hp-1",
          hcpName: "Dr. Smith",
          hcpSpecialty: "Oncology",
          roleInConference: "audience",
          voiceId: "v1",
          sortOrder: 0,
          status: "listening",
        },
      ]),
      keyMessagesStatus: JSON.stringify([
        { message: "Key message 1", delivered: false },
      ]),
      createdAt: new Date().toISOString(),
    };
  });

  // ── Basic rendering ──
  it("renders the conference header", () => {
    renderConferenceSession();
    expect(screen.getByTestId("conference-header")).toBeInTheDocument();
  });

  it("renders the topic guide with scenario name", () => {
    renderConferenceSession();
    expect(screen.getByTestId("topic-guide")).toBeInTheDocument();
    expect(screen.getByText("Drug Efficacy")).toBeInTheDocument();
  });

  it("renders the conference stage", () => {
    renderConferenceSession();
    expect(screen.getByTestId("conference-stage")).toBeInTheDocument();
  });

  it("renders the transcription panel", () => {
    renderConferenceSession();
    expect(screen.getByTestId("transcription-panel")).toBeInTheDocument();
  });

  it("renders the audience panel", () => {
    renderConferenceSession();
    expect(screen.getByTestId("audience-panel")).toBeInTheDocument();
  });

  it("renders the question queue", () => {
    renderConferenceSession();
    expect(screen.getByTestId("question-queue")).toBeInTheDocument();
  });

  // ── End session dialog ──
  it("shows end session dialog when End button is clicked", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    const endButton = screen.getByText("End");
    await user.click(endButton);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    const endPresentationEls = screen.getAllByText("endPresentation");
    expect(endPresentationEls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("endConfirm")).toBeInTheDocument();
  });

  it("closes the dialog when continuePresenting is clicked", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    await user.click(screen.getByText("End"));
    expect(screen.getByTestId("dialog")).toBeInTheDocument();

    await user.click(screen.getByText("continuePresenting"));
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("navigates on confirm end session", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    await user.click(screen.getByText("End"));
    expect(screen.getByTestId("dialog")).toBeInTheDocument();

    const endButtons = screen.getAllByText("endPresentation");
    const confirmBtn = endButtons[endButtons.length - 1];
    if (confirmBtn) {
      await user.click(confirmBtn);
    }
    expect(mockMutateAsync).toHaveBeenCalledWith("cs-1");
    expect(mockNavigate).toHaveBeenCalledWith("/user/scoring?id=cs-1");
  });

  it("handles end session mutation failure gracefully", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Network error"));
    const user = userEvent.setup();
    renderConferenceSession();

    await user.click(screen.getByText("End"));
    const endButtons = screen.getAllByText("endPresentation");
    const confirmBtn = endButtons[endButtons.length - 1];
    if (confirmBtn) {
      await user.click(confirmBtn);
    }
    // Should not navigate on failure
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ── handlePresent / sendMessage ──
  it("adds user message and calls sendMessage when presenting", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    await user.click(screen.getByText("Send"));
    expect(mockSendMessage).toHaveBeenCalledWith("present", "Hello HCP");
  });

  // ── SSE callback: onSpeakerText ──
  it("adds HCP message to state via onSpeakerText callback", () => {
    renderConferenceSession();

    act(() => {
      capturedCallbacks.onSpeakerText?.({
        speaker_id: "hcp-1",
        speaker_name: "Dr. Smith",
        content: "Thanks for your presentation",
      });
    });

    // Verify the messages were passed to ConferenceStage
    const msgs = capturedConferenceStageProps.messages as Array<{
      sender: string;
      text: string;
      speakerName: string;
    }>;
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.sender).toBe("hcp");
    expect(msgs[0]?.text).toBe("Thanks for your presentation");
    expect(msgs[0]?.speakerName).toBe("Dr. Smith");
  });

  it("updates currentSpeaker via onSpeakerText callback", () => {
    renderConferenceSession();

    act(() => {
      capturedCallbacks.onSpeakerText?.({
        speaker_id: "hcp-1",
        speaker_name: "Dr. Smith",
        content: "Hello",
      });
    });

    expect(capturedConferenceStageProps.currentSpeaker).toBe("Dr. Smith");
  });

  // ── SSE callback: onQueueUpdate ──
  it("updates question queue via onQueueUpdate callback", () => {
    renderConferenceSession();

    const newQueue = [
      {
        hcpProfileId: "hp-1",
        hcpName: "Dr. Smith",
        question: "What about side effects?",
        relevanceScore: 0.9,
        status: "waiting" as const,
      },
    ];

    act(() => {
      capturedCallbacks.onQueueUpdate?.(newQueue);
    });

    const questions = capturedQuestionQueueProps.questions as typeof newQueue;
    expect(questions).toHaveLength(1);
    expect(questions[0]?.question).toBe("What about side effects?");
  });

  // ── SSE callback: onTurnChange ──
  it("updates current speaker and audience status via onTurnChange callback", () => {
    renderConferenceSession();

    act(() => {
      capturedCallbacks.onTurnChange?.({
        speaker_id: "hcp-1",
        speaker_name: "Dr. Smith",
        action: "asking",
      });
    });

    expect(capturedConferenceStageProps.currentSpeaker).toBe("Dr. Smith");
    const hcps = capturedAudiencePanelProps.hcps as Array<{
      id: string;
      status: string;
    }>;
    const smith = hcps.find((h) => h.id === "hcp-1");
    expect(smith?.status).toBe("speaking");
  });

  it("sets audience to listening when turn change action is listening", () => {
    renderConferenceSession();

    // First set to speaking
    act(() => {
      capturedCallbacks.onTurnChange?.({
        speaker_id: "hcp-1",
        speaker_name: "Dr. Smith",
        action: "asking",
      });
    });

    // Then set back to listening
    act(() => {
      capturedCallbacks.onTurnChange?.({
        speaker_id: "hcp-1",
        speaker_name: "Dr. Smith",
        action: "listening",
      });
    });

    const hcps = capturedAudiencePanelProps.hcps as Array<{
      id: string;
      status: string;
    }>;
    const smith = hcps.find((h) => h.id === "hcp-1");
    expect(smith?.status).toBe("listening");
  });

  // ── SSE callback: onSubState ──
  it("updates subState via onSubState callback", () => {
    renderConferenceSession();

    act(() => {
      capturedCallbacks.onSubState?.({
        sub_state: "qa",
        message: "Entering Q&A",
      });
    });

    expect(capturedConferenceHeaderProps.subState).toBe("qa");
  });

  // ── SSE callback: onTranscription ──
  it("adds transcript lines via onTranscription callback", () => {
    renderConferenceSession();

    act(() => {
      capturedCallbacks.onTranscription?.({
        speaker: "Dr. Smith",
        text: "First transcript line",
        timestamp: "2024-01-01T10:00:00Z",
      });
    });

    const lines = capturedTranscriptionPanelProps.lines as Array<{
      speaker: string;
      text: string;
    }>;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe("First transcript line");
  });

  it("appends multiple transcript lines", () => {
    renderConferenceSession();

    act(() => {
      capturedCallbacks.onTranscription?.({
        speaker: "MR",
        text: "Line 1",
        timestamp: "2024-01-01T10:00:00Z",
      });
    });

    act(() => {
      capturedCallbacks.onTranscription?.({
        speaker: "Dr. Smith",
        text: "Line 2",
        timestamp: "2024-01-01T10:01:00Z",
      });
    });

    const lines = capturedTranscriptionPanelProps.lines as Array<{
      speaker: string;
      text: string;
    }>;
    expect(lines).toHaveLength(2);
    expect(lines[0]?.speaker).toBe("MR");
    expect(lines[1]?.speaker).toBe("Dr. Smith");
  });

  // ── SSE callback: onKeyMessages ──
  it("updates key topics via onKeyMessages callback", () => {
    renderConferenceSession();

    const newTopics = [
      { message: "Efficacy data", delivered: true },
      { message: "Safety profile", delivered: false },
    ];

    act(() => {
      capturedCallbacks.onKeyMessages?.(newTopics);
    });

    const topics = capturedTopicGuideProps.topics as typeof newTopics;
    expect(topics).toHaveLength(2);
    expect(topics[0]?.delivered).toBe(true);
  });

  // ── SSE callback: onDone ──
  it("handles onDone callback without crashing", () => {
    renderConferenceSession();

    // onDone is a no-op but shouldn't throw
    act(() => {
      capturedCallbacks.onDone?.();
    });

    expect(screen.getByTestId("conference-stage")).toBeInTheDocument();
  });

  // ── SSE callback: onError ──
  it("handles onError callback", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderConferenceSession();

    act(() => {
      capturedCallbacks.onError?.("Something went wrong");
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Conference SSE error:",
      "Something went wrong",
    );
    consoleSpy.mockRestore();
  });

  // ── Respond to question ──
  it("responds to a question from the queue", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    // First set up the question queue via SSE
    act(() => {
      capturedCallbacks.onQueueUpdate?.([
        {
          hcpProfileId: "hp-1",
          hcpName: "Dr. Smith",
          question: "What about side effects?",
          relevanceScore: 0.9,
          status: "waiting",
        },
      ]);
    });

    // Click respond
    await user.click(screen.getByText("Respond"));

    expect(mockSendMessage).toHaveBeenCalledWith("respond", "", "hp-1");
  });

  it("does not respond if no matching waiting question in queue", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    // Queue with already active question
    act(() => {
      capturedCallbacks.onQueueUpdate?.([
        {
          hcpProfileId: "hp-1",
          hcpName: "Dr. Smith",
          question: "Side effects?",
          relevanceScore: 0.9,
          status: "active",
        },
      ]);
    });

    await user.click(screen.getByText("Respond"));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  // ── Toggle panels ──
  it("toggles left panel (topic guide)", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    // Initially not collapsed
    expect(capturedTopicGuideProps.isCollapsed).toBe(false);

    await user.click(screen.getByText("ToggleLeft"));
    expect(capturedTopicGuideProps.isCollapsed).toBe(true);

    await user.click(screen.getByText("ToggleLeft"));
    expect(capturedTopicGuideProps.isCollapsed).toBe(false);
  });

  it("toggles right panel (transcription)", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    expect(capturedTranscriptionPanelProps.isCollapsed).toBe(false);

    await user.click(screen.getByText("ToggleRight"));
    expect(capturedTranscriptionPanelProps.isCollapsed).toBe(true);
  });

  // ── Voice toggle ──
  it("toggles voice mode via conference header", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    // Initially text mode
    expect(capturedConferenceStageProps.inputMode).toBe("text");

    await user.click(screen.getByText("ToggleVoice"));
    expect(capturedConferenceStageProps.inputMode).toBe("audio");
  });

  // ── Session initialization: audience config ──
  it("initializes audience from session audienceConfig", () => {
    renderConferenceSession();

    const hcps = capturedAudiencePanelProps.hcps as Array<{
      id: string;
      hcpName: string;
      status: string;
    }>;
    expect(hcps).toHaveLength(1);
    expect(hcps[0]?.hcpName).toBe("Dr. Smith");
    expect(hcps[0]?.status).toBe("listening");
  });

  it("handles invalid audienceConfig JSON gracefully", () => {
    mockSessionData = {
      ...mockSessionData,
      audienceConfig: "not-valid-json",
    };
    // Should not throw
    renderConferenceSession();
    expect(screen.getByTestId("audience-panel")).toBeInTheDocument();
  });

  // ── Session initialization: subState ──
  it("initializes subState from session", () => {
    renderConferenceSession();
    expect(capturedConferenceHeaderProps.subState).toBe("presenting");
  });

  // ── Session initialization: key messages ──
  it("initializes key topics from session keyMessagesStatus", () => {
    renderConferenceSession();

    const topics = capturedTopicGuideProps.topics as Array<{
      message: string;
      delivered: boolean;
    }>;
    expect(topics).toHaveLength(1);
    expect(topics[0]?.message).toBe("Key message 1");
    expect(topics[0]?.delivered).toBe(false);
  });

  it("handles invalid keyMessagesStatus JSON gracefully", () => {
    mockSessionData = {
      ...mockSessionData,
      keyMessagesStatus: "{bad json",
    };
    renderConferenceSession();
    expect(screen.getByTestId("topic-guide")).toBeInTheDocument();
  });

  // ── Session with no audienceConfig / no keyMessagesStatus ──
  it("handles null audienceConfig", () => {
    mockSessionData = {
      ...mockSessionData,
      audienceConfig: null,
    };
    renderConferenceSession();
    const hcps = capturedAudiencePanelProps.hcps as Array<unknown>;
    expect(hcps).toHaveLength(0);
  });

  it("handles null keyMessagesStatus", () => {
    mockSessionData = {
      ...mockSessionData,
      keyMessagesStatus: null,
    };
    renderConferenceSession();
    const topics = capturedTopicGuideProps.topics as Array<unknown>;
    expect(topics).toHaveLength(0);
  });

  // ── Session with no session data (undefined) ──
  it("renders with undefined session data", () => {
    mockSessionData = undefined;
    renderConferenceSession();
    expect(screen.getByTestId("conference-stage")).toBeInTheDocument();
    // scenarioName falls back to ""
    expect(capturedTopicGuideProps.scenarioName).toBe("");
  });

  // ── Session timer ──
  it("starts session timer and updates sessionTime", () => {
    vi.useFakeTimers();
    renderConferenceSession();

    // Initially or very shortly after: "00:00"
    expect(capturedConferenceHeaderProps.sessionTime).toBeDefined();

    // Advance 65 seconds
    act(() => {
      vi.advanceTimersByTime(65000);
    });

    expect(capturedConferenceHeaderProps.sessionTime).toBe("01:05");
    vi.useRealTimers();
  });

  it("uses session createdAt for timer start time", () => {
    vi.useFakeTimers();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockSessionData = {
      ...mockSessionData,
      createdAt: fiveMinutesAgo,
    };
    renderConferenceSession();

    // After 1 tick (1 second) should show ~5:01
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const time = capturedConferenceHeaderProps.sessionTime as string;
    expect(time).toMatch(/^05:0/);
    vi.useRealTimers();
  });

  // ── Audience status default ──
  it("sets default status to listening when audience hcp has no status", () => {
    mockSessionData = {
      ...mockSessionData,
      audienceConfig: JSON.stringify([
        {
          id: "hcp-2",
          hcpProfileId: "hp-2",
          hcpName: "Dr. Lee",
          hcpSpecialty: "Cardiology",
          roleInConference: "audience",
          voiceId: "v2",
          sortOrder: 1,
          // status omitted
        },
      ]),
    };
    renderConferenceSession();

    const hcps = capturedAudiencePanelProps.hcps as Array<{
      status: string;
    }>;
    expect(hcps[0]?.status).toBe("listening");
  });

  // ── Speaker color mapping ──
  it("assigns speaker colors correctly via speakerMap", () => {
    renderConferenceSession();

    const speakerMap = capturedTranscriptionPanelProps.speakerMap as Map<
      string,
      number
    >;
    // MR is always index 0
    expect(speakerMap.get("MR")).toBe(0);
    // HCP audience is mapped
    expect(speakerMap.get("hcp-1")).toBeDefined();
    expect(speakerMap.get("Dr. Smith")).toBeDefined();
  });

  // ── Completed session ──
  it("passes disabled=true when session is completed", () => {
    mockSessionData = {
      ...mockSessionData,
      status: "completed",
    };
    renderConferenceSession();
    expect(capturedConferenceStageProps.disabled).toBe(true);
  });

  it("passes disabled=false when session is in_progress", () => {
    renderConferenceSession();
    expect(capturedConferenceStageProps.disabled).toBe(false);
  });

  // ── Mic click handling ──
  it("delegates mic click to conference stage", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    await user.click(screen.getByText("Mic"));
    // When idle, it calls startRecording
    expect(mockStartRecording).toHaveBeenCalled();
  });

  // ── Turn change matching by hcpProfileId ──
  it("matches turn change by hcpProfileId", () => {
    renderConferenceSession();

    act(() => {
      capturedCallbacks.onTurnChange?.({
        speaker_id: "hp-1", // matches hcpProfileId, not id
        speaker_name: "Dr. Smith",
        action: "asking",
      });
    });

    const hcps = capturedAudiencePanelProps.hcps as Array<{
      id: string;
      status: string;
    }>;
    const smith = hcps.find((h) => h.id === "hcp-1");
    expect(smith?.status).toBe("speaking");
  });

  // ── onText callback (no-op) ──
  it("handles onText callback without crashing", () => {
    renderConferenceSession();
    act(() => {
      capturedCallbacks.onText?.("some streamed chunk");
    });
    expect(screen.getByTestId("conference-stage")).toBeInTheDocument();
  });
});
