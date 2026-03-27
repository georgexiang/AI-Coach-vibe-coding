import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeSelector } from "./mode-selector";

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

describe("ModeSelector", () => {
  const defaultProps = {
    value: "text" as const,
    onChange: vi.fn(),
    voiceLiveAvailable: true,
    avatarAvailable: true,
  };

  it("renders three mode buttons (text, voice, avatar)", () => {
    render(<ModeSelector {...defaultProps} />);
    expect(screen.getByTestId("mode-text")).toBeInTheDocument();
    expect(screen.getByTestId("mode-voice")).toBeInTheDocument();
    expect(screen.getByTestId("mode-avatar")).toBeInTheDocument();
  });

  it("text mode button is always enabled", () => {
    render(
      <ModeSelector
        {...defaultProps}
        voiceLiveAvailable={false}
        avatarAvailable={false}
      />,
    );
    const textBtn = screen.getByTestId("mode-text");
    expect(textBtn).not.toBeDisabled();
  });

  it("voice button is disabled when voiceLiveAvailable is false", () => {
    render(
      <ModeSelector {...defaultProps} voiceLiveAvailable={false} />,
    );
    const voiceBtn = screen.getByTestId("mode-voice");
    expect(voiceBtn).toBeDisabled();
  });

  it("avatar button is disabled when avatarAvailable is false", () => {
    render(
      <ModeSelector {...defaultProps} avatarAvailable={false} />,
    );
    const avatarBtn = screen.getByTestId("mode-avatar");
    expect(avatarBtn).toBeDisabled();
  });

  it("calls onChange with voice when voice button is clicked and available", () => {
    const onChange = vi.fn();
    render(<ModeSelector {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("mode-voice"));
    expect(onChange).toHaveBeenCalledWith("voice");
  });

  it("active mode button has primary styling class", () => {
    render(<ModeSelector {...defaultProps} value="text" />);
    const textBtn = screen.getByTestId("mode-text");
    expect(textBtn.className).toContain("bg-primary");
  });

  it("inactive mode buttons have muted foreground text class", () => {
    render(<ModeSelector {...defaultProps} value="text" />);
    const voiceBtn = screen.getByTestId("mode-voice");
    expect(voiceBtn.className).toContain("text-muted-foreground");
  });

  it("shows modeSelector label text", () => {
    render(<ModeSelector {...defaultProps} />);
    expect(screen.getByText("modeSelector")).toBeInTheDocument();
  });

  it("does not call onChange when disabled button is clicked", () => {
    const onChange = vi.fn();
    render(
      <ModeSelector
        {...defaultProps}
        onChange={onChange}
        voiceLiveAvailable={false}
      />,
    );
    fireEvent.click(screen.getByTestId("mode-voice"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
