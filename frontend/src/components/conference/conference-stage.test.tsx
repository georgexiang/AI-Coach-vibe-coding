import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConferenceStage } from "./conference-stage";

vi.mock("@/components/shared", () => ({
  ChatBubble: ({
    text,
    speakerName,
  }: {
    text: string;
    speakerName?: string;
  }) => (
    <div data-testid="chat-bubble">
      {speakerName && <span>{speakerName}</span>}
      <span>{text}</span>
    </div>
  ),
  ChatInput: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="chat-input" data-disabled={disabled} />
  ),
}));

describe("ConferenceStage", () => {
  const defaultProps = {
    sessionId: "sess-1",
    onSendMessage: vi.fn(),
    isStreaming: false,
    streamedText: "",
    currentSpeaker: "Dr. Chen",
    avatarEnabled: true,
    featureAvatarEnabled: true,
  };

  it("renders avatar with speaker initials when avatarEnabled", () => {
    render(<ConferenceStage {...defaultProps} />);
    expect(screen.getByText("DC")).toBeInTheDocument();
  });

  it("renders current speaker name below avatar when avatarEnabled", () => {
    render(<ConferenceStage {...defaultProps} />);
    expect(screen.getByText("Dr. Chen")).toBeInTheDocument();
  });

  it("renders fallback text when avatar is disabled", () => {
    render(<ConferenceStage {...defaultProps} avatarEnabled={false} />);
    expect(screen.getByText("Dr. Chen")).toBeInTheDocument();
  });

  it("shows 'Conference Stage' when avatar disabled and no current speaker", () => {
    render(
      <ConferenceStage {...defaultProps} avatarEnabled={false} currentSpeaker="" />,
    );
    expect(screen.getByText("Conference Stage")).toBeInTheDocument();
  });

  it("renders chat messages", () => {
    const messages = [
      {
        id: "m1",
        sender: "hcp" as const,
        text: "Hello MR",
        timestamp: new Date(),
        speakerName: "Dr. Chen",
      },
      {
        id: "m2",
        sender: "mr" as const,
        text: "Good morning",
        timestamp: new Date(),
      },
    ];
    render(<ConferenceStage {...defaultProps} messages={messages} />);
    const bubbles = screen.getAllByTestId("chat-bubble");
    expect(bubbles).toHaveLength(2);
    expect(screen.getByText("Hello MR")).toBeInTheDocument();
    expect(screen.getByText("Good morning")).toBeInTheDocument();
  });

  it("shows streamed text when streaming", () => {
    render(
      <ConferenceStage
        {...defaultProps}
        isStreaming={true}
        streamedText="Partial response..."
      />,
    );
    expect(screen.getByText("Partial response...")).toBeInTheDocument();
  });

  it("shows typing indicator when streaming without text", () => {
    const { container } = render(
      <ConferenceStage {...defaultProps} isStreaming={true} streamedText="" />,
    );
    const bounceDots = container.querySelectorAll(".animate-bounce");
    expect(bounceDots.length).toBe(3);
  });

  it("does not show typing indicator when not streaming", () => {
    const { container } = render(
      <ConferenceStage {...defaultProps} isStreaming={false} streamedText="" />,
    );
    const bounceDots = container.querySelectorAll(".animate-bounce");
    expect(bounceDots.length).toBe(0);
  });

  it("renders ChatInput component", () => {
    render(<ConferenceStage {...defaultProps} />);
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });

  it("passes disabled prop to ChatInput", () => {
    render(<ConferenceStage {...defaultProps} disabled={true} />);
    expect(screen.getByTestId("chat-input")).toHaveAttribute(
      "data-disabled",
      "true",
    );
  });

  it("uses 'AI' as fallback initials when currentSpeaker is empty", () => {
    render(<ConferenceStage {...defaultProps} currentSpeaker="" avatarEnabled={true} />);
    expect(screen.getByText("AI")).toBeInTheDocument();
  });
});
