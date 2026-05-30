import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatTranscript } from "./chat-transcript";
import type { SessionMessage } from "@/types/session";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/coach/chat-message", () => ({
  ChatMessage: ({ message }: { message: SessionMessage }) => (
    <div data-testid={`msg-${message.id}`}>{message.content}</div>
  ),
}));

vi.mock("@/components/coach/typing-indicator", () => ({
  TypingIndicator: () => <div data-testid="typing-indicator" />,
}));

const mockMessages: SessionMessage[] = [
  {
    id: "msg-1",
    session_id: "s1",
    role: "user",
    content: "Hello doctor",
    message_index: 0,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "msg-2",
    session_id: "s1",
    role: "assistant",
    content: "Hello, how can I help?",
    message_index: 1,
    created_at: "2026-01-01T00:00:01Z",
  },
];

describe("ChatTranscript", () => {
  it("renders all messages", () => {
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={false}
        inputMode="text"
      />,
    );

    expect(screen.getByTestId("msg-msg-1")).toBeInTheDocument();
    expect(screen.getByTestId("msg-msg-2")).toBeInTheDocument();
  });

  it("shows typing indicator when streaming without text", () => {
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={true}
        inputMode="text"
      />,
    );

    expect(screen.getByTestId("typing-indicator")).toBeInTheDocument();
  });

  it("shows streaming message when streaming with text", () => {
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={true}
        streamingText="Streaming content..."
        inputMode="text"
      />,
    );

    expect(screen.getByText("Streaming content...")).toBeInTheDocument();
  });

  it("shows text input in text mode", () => {
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={false}
        inputMode="text"
        onSendTextMessage={vi.fn()}
      />,
    );

    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
    expect(screen.getByTestId("send-btn")).toBeInTheDocument();
  });

  it("hides text input in voice mode", () => {
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={false}
        inputMode="voice"
        onSendTextMessage={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument();
  });

  it("calls onSendTextMessage when send button clicked", () => {
    const onSend = vi.fn();
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={false}
        inputMode="text"
        onSendTextMessage={onSend}
      />,
    );

    const input = screen.getByTestId("chat-input");
    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.click(screen.getByTestId("send-btn"));

    expect(onSend).toHaveBeenCalledWith("Test message");
  });

  it("clears input after sending", () => {
    const onSend = vi.fn();
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={false}
        inputMode="text"
        onSendTextMessage={onSend}
      />,
    );

    const input = screen.getByTestId("chat-input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.click(screen.getByTestId("send-btn"));

    expect(input.value).toBe("");
  });

  it("sends on Enter key (not shift+Enter)", () => {
    const onSend = vi.fn();
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={false}
        inputMode="text"
        onSendTextMessage={onSend}
      />,
    );

    const input = screen.getByTestId("chat-input");
    fireEvent.change(input, { target: { value: "Enter message" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(onSend).toHaveBeenCalledWith("Enter message");
  });

  it("does not send on Shift+Enter", () => {
    const onSend = vi.fn();
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={false}
        inputMode="text"
        onSendTextMessage={onSend}
      />,
    );

    const input = screen.getByTestId("chat-input");
    fireEvent.change(input, { target: { value: "No send" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables send button when input is empty", () => {
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={false}
        inputMode="text"
        onSendTextMessage={vi.fn()}
      />,
    );

    expect(screen.getByTestId("send-btn")).toBeDisabled();
  });

  it("disables send button while streaming", () => {
    render(
      <ChatTranscript
        messages={mockMessages}
        isStreaming={true}
        inputMode="text"
        onSendTextMessage={vi.fn()}
      />,
    );

    const input = screen.getByTestId("chat-input");
    fireEvent.change(input, { target: { value: "Text" } });

    expect(screen.getByTestId("send-btn")).toBeDisabled();
  });
});
