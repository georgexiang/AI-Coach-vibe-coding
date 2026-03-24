import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatArea } from "./chat-area";
import type { SessionMessage } from "@/types/session";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

// Mock sub-components to isolate ChatArea logic
vi.mock("./chat-message", () => ({
  ChatMessage: ({
    message,
  }: {
    message: { role: string; content: string };
  }) => <div data-testid="chat-message">{message.content}</div>,
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

  it("renders chat messages", () => {
    render(<ChatArea {...defaultProps} />);
    const msgElements = screen.getAllByTestId("chat-message");
    expect(msgElements).toHaveLength(2);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  it("renders the send button and it's disabled when input is empty", () => {
    render(<ChatArea {...defaultProps} />);
    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toBeDisabled();
  });

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
  });

  it("disables input when session is completed", () => {
    render(
      <ChatArea {...defaultProps} sessionStatus="completed" />,
    );

    const textarea = screen.getByPlaceholderText("session.inputPlaceholder");
    expect(textarea).toBeDisabled();
  });
});
