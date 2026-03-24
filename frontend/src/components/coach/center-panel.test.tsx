import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CenterPanel } from "./center-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

describe("CenterPanel", () => {
  const defaultProps = {
    sessionTime: "05:30",
    onEndSession: vi.fn(),
    messages: [] as { id: string; sender: "hcp" | "mr"; text: string; timestamp: Date }[],
    onSendMessage: vi.fn(),
    avatarEnabled: true,
    onToggleAvatar: vi.fn(),
    hcpInitials: "JS",
    isTyping: false,
    inputMode: "text" as const,
    onMicClick: vi.fn(),
    recordingState: "idle" as const,
  };

  it("renders session time", () => {
    render(<CenterPanel {...defaultProps} />);
    expect(screen.getByText("05:30")).toBeInTheDocument();
  });

  it("renders end session button", () => {
    render(<CenterPanel {...defaultProps} />);
    expect(screen.getByText("endSession")).toBeInTheDocument();
  });

  it("calls onEndSession when end button is clicked", async () => {
    const onEndSession = vi.fn();
    render(<CenterPanel {...defaultProps} onEndSession={onEndSession} />);
    await userEvent.click(screen.getByText("endSession"));
    expect(onEndSession).toHaveBeenCalledOnce();
  });

  it("renders HCP initials when avatar is enabled", () => {
    render(<CenterPanel {...defaultProps} />);
    // initials appear in the avatar and potentially multiple locations
    const initials = screen.getAllByText("JS");
    expect(initials.length).toBeGreaterThan(0);
  });

  it("renders messages", () => {
    const messages = [
      { id: "1", sender: "hcp" as const, text: "Hello MR", timestamp: new Date() },
      { id: "2", sender: "mr" as const, text: "Hi Doctor", timestamp: new Date() },
    ];
    render(<CenterPanel {...defaultProps} messages={messages} />);
    expect(screen.getByText("Hello MR")).toBeInTheDocument();
    expect(screen.getByText("Hi Doctor")).toBeInTheDocument();
  });

  it("renders avatar disabled state", () => {
    render(<CenterPanel {...defaultProps} avatarEnabled={false} />);
    expect(screen.getByText("avatarDisabled")).toBeInTheDocument();
  });

  it("renders typing indicator when isTyping is true", () => {
    const { container } = render(<CenterPanel {...defaultProps} isTyping={true} />);
    const bounceDots = container.querySelectorAll(".animate-bounce");
    expect(bounceDots.length).toBe(3);
  });

  it("does not render typing indicator when isTyping is false", () => {
    const { container } = render(<CenterPanel {...defaultProps} isTyping={false} />);
    const bounceDots = container.querySelectorAll(".animate-bounce");
    expect(bounceDots.length).toBe(0);
  });

  it("renders avatar text label", () => {
    render(<CenterPanel {...defaultProps} />);
    expect(screen.getAllByText("avatar").length).toBeGreaterThan(0);
  });
});
