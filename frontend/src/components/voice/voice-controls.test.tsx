import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VoiceControls } from "./voice-controls";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Tooltip to avoid Radix portal issues in tests
vi.mock("@/components/ui", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe("VoiceControls", () => {
  const defaultProps = {
    audioState: "idle" as const,
    connectionState: "connected" as const,
    isMuted: false,
    onToggleMute: vi.fn(),
    onToggleKeyboard: vi.fn(),
  };

  it("renders mic button", () => {
    render(<VoiceControls {...defaultProps} />);
    expect(screen.getByTestId("mic-button")).toBeInTheDocument();
  });

  it("calls onToggleMute when mute button is clicked", () => {
    const onToggleMute = vi.fn();
    render(
      <VoiceControls {...defaultProps} onToggleMute={onToggleMute} />,
    );
    const muteBtn = screen.getByLabelText("mute");
    fireEvent.click(muteBtn);
    expect(onToggleMute).toHaveBeenCalled();
  });

  it("calls onToggleKeyboard when keyboard button is clicked", () => {
    const onToggleKeyboard = vi.fn();
    render(
      <VoiceControls {...defaultProps} onToggleKeyboard={onToggleKeyboard} />,
    );
    const kbBtn = screen.getByLabelText("keyboardInput");
    fireEvent.click(kbBtn);
    expect(onToggleKeyboard).toHaveBeenCalled();
  });

  it("mic button is disabled when connectionState is connecting", () => {
    render(
      <VoiceControls {...defaultProps} connectionState="connecting" />,
    );
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toBeDisabled();
  });

  it("mic button has correct aria-label for idle state", () => {
    render(<VoiceControls {...defaultProps} audioState="idle" />);
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toHaveAttribute("aria-label", "micButton.idle");
  });

  it("mic button has correct aria-label for listening state", () => {
    render(<VoiceControls {...defaultProps} audioState="listening" />);
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toHaveAttribute("aria-label", "micButton.listening");
  });

  it("mic button has correct aria-label for muted state", () => {
    render(<VoiceControls {...defaultProps} isMuted={true} />);
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toHaveAttribute("aria-label", "micButton.muted");
  });

  it("mic button is disabled when connectionState is disconnected", () => {
    render(
      <VoiceControls {...defaultProps} connectionState="disconnected" />,
    );
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toBeDisabled();
  });

  // NEW TESTS for uncovered branches

  it("mic button has correct aria-label for speaking state", () => {
    render(<VoiceControls {...defaultProps} audioState="speaking" />);
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toHaveAttribute("aria-label", "micButton.speaking");
  });

  it("mic button is disabled when connectionState is reconnecting", () => {
    render(
      <VoiceControls {...defaultProps} connectionState="reconnecting" />,
    );
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toBeDisabled();
  });

  it("mic button has connecting aria-label when reconnecting", () => {
    render(
      <VoiceControls {...defaultProps} connectionState="reconnecting" />,
    );
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toHaveAttribute("aria-label", "micButton.connecting");
  });

  it("mic button is disabled when connectionState is error", () => {
    render(
      <VoiceControls {...defaultProps} connectionState="error" />,
    );
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toBeDisabled();
  });

  it("mic button has disabled aria-label when connectionState is error", () => {
    render(
      <VoiceControls {...defaultProps} connectionState="error" />,
    );
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toHaveAttribute("aria-label", "micButton.disabled");
  });

  it("mute toggle button shows unmute label when muted", () => {
    render(<VoiceControls {...defaultProps} isMuted={true} />);
    expect(screen.getByLabelText("unmute")).toBeInTheDocument();
  });

  it("mute toggle button shows mute label when not muted", () => {
    render(<VoiceControls {...defaultProps} isMuted={false} />);
    expect(screen.getByLabelText("mute")).toBeInTheDocument();
  });

  it("mute toggle button is disabled when not connected", () => {
    render(
      <VoiceControls {...defaultProps} connectionState="disconnected" />,
    );
    const muteBtn = screen.getByLabelText("mute");
    expect(muteBtn).toBeDisabled();
  });

  it("renders view toggle button when onToggleView is provided", () => {
    const onToggleView = vi.fn();
    render(
      <VoiceControls {...defaultProps} onToggleView={onToggleView} />,
    );
    expect(screen.getByLabelText("fullScreen")).toBeInTheDocument();
  });

  it("does not render view toggle button when onToggleView is not provided", () => {
    render(<VoiceControls {...defaultProps} />);
    expect(screen.queryByLabelText("fullScreen")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("embeddedView")).not.toBeInTheDocument();
  });

  it("view toggle shows embedded view label when isFullScreen is true", () => {
    const onToggleView = vi.fn();
    render(
      <VoiceControls
        {...defaultProps}
        onToggleView={onToggleView}
        isFullScreen={true}
      />,
    );
    expect(screen.getByLabelText("embeddedView")).toBeInTheDocument();
  });

  it("view toggle shows fullScreen label when isFullScreen is false", () => {
    const onToggleView = vi.fn();
    render(
      <VoiceControls
        {...defaultProps}
        onToggleView={onToggleView}
        isFullScreen={false}
      />,
    );
    expect(screen.getByLabelText("fullScreen")).toBeInTheDocument();
  });

  it("calls onToggleView when view toggle button is clicked", () => {
    const onToggleView = vi.fn();
    render(
      <VoiceControls {...defaultProps} onToggleView={onToggleView} />,
    );
    const viewBtn = screen.getByLabelText("fullScreen");
    fireEvent.click(viewBtn);
    expect(onToggleView).toHaveBeenCalled();
  });

  it("applies custom className", () => {
    const { container } = render(
      <VoiceControls {...defaultProps} className="custom-class" />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
  });

  it("renders pulse animation when listening and connected", () => {
    const { container } = render(
      <VoiceControls
        {...defaultProps}
        audioState="listening"
        connectionState="connected"
      />,
    );
    const pulseEl = container.querySelector(".animate-ping");
    expect(pulseEl).toBeTruthy();
  });

  it("does not render pulse animation when speaking", () => {
    const { container } = render(
      <VoiceControls
        {...defaultProps}
        audioState="speaking"
        connectionState="connected"
      />,
    );
    const pulseEl = container.querySelector(".animate-ping");
    expect(pulseEl).toBeNull();
  });

  it("does not render pulse animation when idle", () => {
    const { container } = render(
      <VoiceControls
        {...defaultProps}
        audioState="idle"
        connectionState="connected"
      />,
    );
    const pulseEl = container.querySelector(".animate-ping");
    expect(pulseEl).toBeNull();
  });

  it("renders spinner icon when connectionState is connecting", () => {
    const { container } = render(
      <VoiceControls {...defaultProps} connectionState="connecting" />,
    );
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("mic button calls onToggleMute when connected and clicked", () => {
    const onToggleMute = vi.fn();
    render(
      <VoiceControls {...defaultProps} onToggleMute={onToggleMute} />,
    );
    const micBtn = screen.getByTestId("mic-button");
    fireEvent.click(micBtn);
    expect(onToggleMute).toHaveBeenCalled();
  });
});
