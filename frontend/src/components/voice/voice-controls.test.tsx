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
});
