import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatArea } from "./chat-area";
import type { SessionMessage } from "@/types/session";

const mockSpeak = vi.fn().mockResolvedValue(undefined);
const mockStopSpeech = vi.fn();
const mockStartRecording = vi.fn();
const mockStopRecording = vi.fn();
let mockRecordingState = "idle";
let mockIsSpeaking = false;
let mockVoiceEnabled = false;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/contexts/config-context", () => ({
  useConfig: () => ({
    avatar_enabled: false,
    voice_enabled: mockVoiceEnabled,
    realtime_voice_enabled: false,
    conference_enabled: false,
    voice_live_enabled: false,
    default_voice_mode: "text_only",
    region: "global",
  }),
}));

vi.mock("@/hooks/use-speech", () => ({
  useSpeechInput: () => ({
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    recordingState: mockRecordingState,
    error: null,
  }),
  useTextToSpeech: () => ({
    speak: mockSpeak,
    stop: mockStopSpeech,
    isSpeaking: mockIsSpeaking,
  }),
}));

// Mock sub-components to isolate ChatArea logic
vi.mock("./chat-message", () => ({
  ChatMessage: ({
    message,
    isStreaming,
  }: {
    message: { role?: string; content: string };
    isStreaming?: boolean;
  }) => (
    <div data-testid="chat-message" data-streaming={isStreaming}>
      {message.content}
    </div>
  ),
}));

vi.mock("./typing-indicator", () => ({
  TypingIndicator: () => <div data-testid="typing-indicator" />,
}));

vi.mock("./session-timer", () => ({
  SessionTimer: () => <div data-testid="session-timer" />,
}));

describe("ChatArea", () => {
  const messages: SessionMessage[] = [
    {
      id: "1",
      session_id: "sess-1",
      role: "user",
      content: "Hello",
      message_index: 0,
      created_at: "2024-01-01T10:00:00Z",
    },
    {
      id: "2",
      session_id: "sess-1",
      role: "assistant",
      content: "Hi there",
      message_index: 1,
      created_at: "2024-01-01T10:01:00Z",
    },
  ];

  const defaultProps = {
    sessionId: "sess-1",
    messages,
    onSendMessage: vi.fn(),
    isStreaming: false,
    streamingText: "",
    onEndSession: vi.fn(),
    sessionStatus: "in_progress" as const,
    startedAt: "2024-01-01T10:00:00Z",
    hcpInitials: "DS",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordingState = "idle";
    mockIsSpeaking = false;
    mockVoiceEnabled = false;
  });

  // ── Basic rendering ──
  it("renders chat messages", () => {
    render(<ChatArea {...defaultProps} />);
    const msgElements = screen.getAllByTestId("chat-message");
    expect(msgElements).toHaveLength(2);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  it("renders session timer", () => {
    render(<ChatArea {...defaultProps} />);
    expect(screen.getByTestId("session-timer")).toBeInTheDocument();
  });

  it("renders end session button", () => {
    render(<ChatArea {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /session\.endSession/i }),
    ).toBeInTheDocument();
  });

  it("renders the send button and it is disabled when input is empty", () => {
    render(<ChatArea {...defaultProps} />);
    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toBeDisabled();
  });

  // ── Send message flow ──
  it("enables send button when text is typed", async () => {
    const user = userEvent.setup();
    render(<ChatArea {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("session.inputPlaceholder");
    await user.type(textarea, "New message");

    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).not.toBeDisabled();
  });

  it("calls onSendMessage and clears input when send is clicked", async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    render(<ChatArea {...defaultProps} onSendMessage={onSendMessage} />);

    const textarea = screen.getByPlaceholderText("session.inputPlaceholder");
    await user.type(textarea, "Test message");

    const sendButton = screen.getByRole("button", { name: "Send message" });
    await user.click(sendButton);

    expect(onSendMessage).toHaveBeenCalledWith("Test message");
    // Input should be cleared
    expect(textarea).toHaveValue("");
  });

  it("sends message on Enter key press", async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    render(<ChatArea {...defaultProps} onSendMessage={onSendMessage} />);

    const textarea = screen.getByPlaceholderText("session.inputPlaceholder");
    await user.type(textarea, "Enter message");
    await user.keyboard("{Enter}");

    expect(onSendMessage).toHaveBeenCalledWith("Enter message");
  });

  it("does not send message on Shift+Enter", async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    render(<ChatArea {...defaultProps} onSendMessage={onSendMessage} />);

    const textarea = screen.getByPlaceholderText("session.inputPlaceholder");
    await user.type(textarea, "Multi line");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("does not send when input is only whitespace", async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    render(<ChatArea {...defaultProps} onSendMessage={onSendMessage} />);

    const textarea = screen.getByPlaceholderText("session.inputPlaceholder");
    await user.type(textarea, "   ");

    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toBeDisabled();
  });

  it("does not send when currently streaming", async () => {
    const onSendMessage = vi.fn();

    render(
      <ChatArea
        {...defaultProps}
        onSendMessage={onSendMessage}
        isStreaming={true}
      />,
    );

    const textarea = screen.getByPlaceholderText("session.inputPlaceholder");
    // Textarea is disabled when streaming
    expect(textarea).toBeDisabled();
  });

  // ── Session status ──
  it("disables input when session is completed", () => {
    render(<ChatArea {...defaultProps} sessionStatus="completed" />);
    const textarea = screen.getByPlaceholderText("session.inputPlaceholder");
    expect(textarea).toBeDisabled();
  });

  it("disables end session button when session is completed", () => {
    render(<ChatArea {...defaultProps} sessionStatus="completed" />);
    const endBtn = screen.getByRole("button", { name: /session\.endSession/i });
    expect(endBtn).toBeDisabled();
  });

  it("enables end session button when session is in_progress", () => {
    render(<ChatArea {...defaultProps} />);
    const endBtn = screen.getByRole("button", { name: /session\.endSession/i });
    expect(endBtn).not.toBeDisabled();
  });

  it("enables end session button when session is created", () => {
    render(<ChatArea {...defaultProps} sessionStatus="created" />);
    const endBtn = screen.getByRole("button", { name: /session\.endSession/i });
    expect(endBtn).not.toBeDisabled();
  });

  it("calls onEndSession when end button is clicked", async () => {
    const user = userEvent.setup();
    const onEndSession = vi.fn();
    render(<ChatArea {...defaultProps} onEndSession={onEndSession} />);
    const endBtn = screen.getByRole("button", { name: /session\.endSession/i });
    await user.click(endBtn);
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });

  // ── Streaming display ──
  it("shows streaming text as a chat message when streaming", () => {
    render(
      <ChatArea
        {...defaultProps}
        isStreaming={true}
        streamingText="Streaming response..."
      />,
    );

    const msgs = screen.getAllByTestId("chat-message");
    // 2 existing messages + 1 streaming
    expect(msgs).toHaveLength(3);
    expect(screen.getByText("Streaming response...")).toBeInTheDocument();
  });

  it("shows typing indicator when streaming with no text yet", () => {
    render(
      <ChatArea {...defaultProps} isStreaming={true} streamingText="" />,
    );

    expect(screen.getByTestId("typing-indicator")).toBeInTheDocument();
  });

  it("does not show typing indicator when not streaming", () => {
    render(<ChatArea {...defaultProps} />);
    expect(
      screen.queryByTestId("typing-indicator"),
    ).not.toBeInTheDocument();
  });

  // ── Avatar toggle ──
  it("renders avatar with hcpInitials by default", () => {
    render(<ChatArea {...defaultProps} hcpInitials="AB" />);
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("uses default hcpInitials HC when not provided", () => {
    const { hcpInitials: _, ...propsWithout } = defaultProps;
    render(<ChatArea {...propsWithout} />);
    expect(screen.getByText("HC")).toBeInTheDocument();
  });

  it("toggles avatar visibility via switch", async () => {
    const user = userEvent.setup();
    render(<ChatArea {...defaultProps} />);

    // Avatar should be visible initially
    expect(screen.getByText("DS")).toBeInTheDocument();

    // Find the switch and toggle it
    const switchEl = screen.getByRole("switch");
    await user.click(switchEl);

    // Avatar should be hidden
    expect(screen.queryByText("DS")).not.toBeInTheDocument();

    // Toggle back
    await user.click(switchEl);
    expect(screen.getByText("DS")).toBeInTheDocument();
  });

  // ── Voice enabled features ──
  it("shows mic button when voice is enabled", () => {
    mockVoiceEnabled = true;
    render(<ChatArea {...defaultProps} />);

    const micBtn = screen.getByLabelText("session.startRecording");
    expect(micBtn).toBeInTheDocument();
  });

  it("does not show mic button when voice is disabled", () => {
    mockVoiceEnabled = false;
    render(<ChatArea {...defaultProps} />);

    expect(
      screen.queryByLabelText("session.startRecording"),
    ).not.toBeInTheDocument();
  });

  it("calls startRecording when mic is clicked in idle state", async () => {
    mockVoiceEnabled = true;
    mockRecordingState = "idle";
    const user = userEvent.setup();
    render(<ChatArea {...defaultProps} />);

    await user.click(screen.getByLabelText("session.startRecording"));
    expect(mockStartRecording).toHaveBeenCalled();
  });

  it("calls stopRecording when mic is clicked in recording state", async () => {
    mockVoiceEnabled = true;
    mockRecordingState = "recording";
    const user = userEvent.setup();
    render(<ChatArea {...defaultProps} />);

    await user.click(screen.getByLabelText("session.stopRecording"));
    expect(mockStopRecording).toHaveBeenCalled();
  });

  it("disables mic button when processing", () => {
    mockVoiceEnabled = true;
    mockRecordingState = "processing";
    render(<ChatArea {...defaultProps} />);

    const micBtn = screen.getByLabelText("session.startRecording");
    expect(micBtn).toBeDisabled();
  });

  it("disables mic button when streaming", () => {
    mockVoiceEnabled = true;
    render(<ChatArea {...defaultProps} isStreaming={true} />);

    const micBtn = screen.getByLabelText("session.startRecording");
    expect(micBtn).toBeDisabled();
  });

  it("disables mic button when session is not active", () => {
    mockVoiceEnabled = true;
    render(<ChatArea {...defaultProps} sessionStatus="completed" />);

    const micBtn = screen.getByLabelText("session.startRecording");
    expect(micBtn).toBeDisabled();
  });

  it("disables textarea when recording", () => {
    mockVoiceEnabled = true;
    mockRecordingState = "recording";
    render(<ChatArea {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("session.inputPlaceholder");
    expect(textarea).toBeDisabled();
  });

  // ── TTS button ──
  it("shows TTS button when voice is enabled", () => {
    mockVoiceEnabled = true;
    render(<ChatArea {...defaultProps} />);

    const ttsBtn = screen.getByLabelText("session.ttsOn");
    expect(ttsBtn).toBeInTheDocument();
  });

  it("does not show TTS button when voice is disabled", () => {
    mockVoiceEnabled = false;
    render(<ChatArea {...defaultProps} />);

    expect(screen.queryByLabelText("session.ttsOn")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("session.ttsOff")).not.toBeInTheDocument();
  });

  it("toggles TTS auto-play on click", async () => {
    mockVoiceEnabled = true;
    const user = userEvent.setup();
    render(<ChatArea {...defaultProps} />);

    // Initially off
    const ttsBtn = screen.getByLabelText("session.ttsOn");
    await user.click(ttsBtn);

    // Now should show ttsOff (meaning it's turned on)
    expect(screen.getByLabelText("session.ttsOff")).toBeInTheDocument();
  });

  it("stops speech when toggling TTS while speaking", async () => {
    mockVoiceEnabled = true;
    mockIsSpeaking = true;
    const user = userEvent.setup();
    render(<ChatArea {...defaultProps} />);

    const ttsBtn = screen.getByLabelText("session.ttsOn");
    await user.click(ttsBtn);

    expect(mockStopSpeech).toHaveBeenCalled();
  });

  // ── TTS auto-play on streaming completion ──
  it("auto-plays TTS when streaming finishes and ttsAutoPlay is on", async () => {
    mockVoiceEnabled = true;
    const user = userEvent.setup();

    const messagesWithAssistant: SessionMessage[] = [
      ...messages,
      {
        id: "3",
        session_id: "sess-1",
        role: "assistant",
        content: "Final AI response",
        message_index: 2,
        created_at: "2024-01-01T10:02:00Z",
      },
    ];

    const { rerender } = render(
      <ChatArea
        {...defaultProps}
        messages={messagesWithAssistant}
        isStreaming={false}
      />,
    );

    // Enable TTS auto-play
    const ttsBtn = screen.getByLabelText("session.ttsOn");
    await user.click(ttsBtn);

    // Now simulate streaming starts
    rerender(
      <ChatArea
        {...defaultProps}
        messages={messagesWithAssistant}
        isStreaming={true}
        streamingText="Streaming..."
      />,
    );

    // Streaming ends
    rerender(
      <ChatArea
        {...defaultProps}
        messages={messagesWithAssistant}
        isStreaming={false}
      />,
    );

    // speak should be called with the last assistant message
    expect(mockSpeak).toHaveBeenCalledWith("Final AI response");
  });

  it("does not auto-play TTS when ttsAutoPlay is off", () => {
    mockVoiceEnabled = true;

    const { rerender } = render(
      <ChatArea {...defaultProps} isStreaming={true} streamingText="..." />,
    );

    rerender(<ChatArea {...defaultProps} isStreaming={false} />);

    expect(mockSpeak).not.toHaveBeenCalled();
  });

  // ── Scroll behavior (chat log) ──
  it("renders a log region with aria-live polite", () => {
    render(<ChatArea {...defaultProps} />);
    const logRegion = screen.getByRole("log");
    expect(logRegion).toHaveAttribute("aria-live", "polite");
  });

  // ── Empty messages ──
  it("renders no chat messages when list is empty", () => {
    render(<ChatArea {...defaultProps} messages={[]} />);
    expect(screen.queryByTestId("chat-message")).not.toBeInTheDocument();
  });

  // ── startedAt null ──
  it("renders with null startedAt", () => {
    render(<ChatArea {...defaultProps} startedAt={null} />);
    expect(screen.getByTestId("session-timer")).toBeInTheDocument();
  });

  it("renders with undefined startedAt", () => {
    const { startedAt: _, ...propsWithout } = defaultProps;
    render(<ChatArea {...propsWithout} />);
    expect(screen.getByTestId("session-timer")).toBeInTheDocument();
  });

  // ── Session status: scored ──
  it("disables input when session is scored", () => {
    render(
      <ChatArea {...defaultProps} sessionStatus={"scored" as "completed"} />,
    );
    const textarea = screen.getByPlaceholderText("session.inputPlaceholder");
    expect(textarea).toBeDisabled();
  });
});
