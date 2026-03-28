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
    pipelineAvailable: true,
    agentAvailable: true,
  };

  it("renders three communication type buttons (text, voice, digital_human)", () => {
    render(<ModeSelector {...defaultProps} />);
    expect(screen.getByTestId("mode-text")).toBeInTheDocument();
    expect(screen.getByTestId("mode-voice")).toBeInTheDocument();
    expect(screen.getByTestId("mode-digital_human")).toBeInTheDocument();
  });

  it("text mode button is always enabled", () => {
    render(
      <ModeSelector
        {...defaultProps}
        voiceLiveAvailable={false}
        avatarAvailable={false}
        pipelineAvailable={false}
        agentAvailable={false}
      />,
    );
    const textBtn = screen.getByTestId("mode-text");
    expect(textBtn).not.toBeDisabled();
  });

  it("voice button is disabled when voiceLive and pipeline are both unavailable", () => {
    render(
      <ModeSelector
        {...defaultProps}
        voiceLiveAvailable={false}
        pipelineAvailable={false}
      />,
    );
    const voiceBtn = screen.getByTestId("mode-voice");
    expect(voiceBtn).toBeDisabled();
  });

  it("digital human button is disabled when avatarAvailable is false", () => {
    render(
      <ModeSelector {...defaultProps} avatarAvailable={false} />,
    );
    const dhBtn = screen.getByTestId("mode-digital_human");
    expect(dhBtn).toBeDisabled();
  });

  it("calls onChange with voice_pipeline when voice + pipeline is selected", () => {
    const onChange = vi.fn();
    render(<ModeSelector {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("mode-voice"));
    expect(onChange).toHaveBeenCalledWith("voice_pipeline");
  });

  it("active communication type button has primary styling class", () => {
    render(<ModeSelector {...defaultProps} value="text" />);
    const textBtn = screen.getByTestId("mode-text");
    expect(textBtn.className).toContain("bg-primary");
  });

  it("inactive communication type buttons have muted foreground text class", () => {
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
        pipelineAvailable={false}
      />,
    );
    fireEvent.click(screen.getByTestId("mode-voice"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows engine row when voice is selected", () => {
    render(<ModeSelector {...defaultProps} value="voice_pipeline" />);
    expect(screen.getByTestId("engine-pipeline")).toBeInTheDocument();
    expect(screen.getByTestId("engine-realtime_model")).toBeInTheDocument();
    expect(screen.getByTestId("engine-realtime_agent")).toBeInTheDocument();
  });

  it("hides engine row when text is selected", () => {
    render(<ModeSelector {...defaultProps} value="text" />);
    expect(screen.queryByTestId("engine-pipeline")).not.toBeInTheDocument();
  });

  it("calls onChange with voice_realtime_agent when switching to agent engine", () => {
    const onChange = vi.fn();
    render(
      <ModeSelector {...defaultProps} value="voice_pipeline" onChange={onChange} />,
    );
    fireEvent.click(screen.getByTestId("engine-realtime_agent"));
    expect(onChange).toHaveBeenCalledWith("voice_realtime_agent");
  });

  it("calls onChange with digital_human_realtime_model when switching engine in DH mode", () => {
    const onChange = vi.fn();
    render(
      <ModeSelector {...defaultProps} value="digital_human_pipeline" onChange={onChange} />,
    );
    fireEvent.click(screen.getByTestId("engine-realtime_model"));
    expect(onChange).toHaveBeenCalledWith("digital_human_realtime_model");
  });

  it("disables agent engine button when agentAvailable is false", () => {
    render(
      <ModeSelector {...defaultProps} value="voice_pipeline" agentAvailable={false} />,
    );
    const agentBtn = screen.getByTestId("engine-realtime_agent");
    expect(agentBtn).toBeDisabled();
  });

  it("disables pipeline engine button when pipelineAvailable is false", () => {
    render(
      <ModeSelector {...defaultProps} value="voice_realtime_model" pipelineAvailable={false} />,
    );
    const pipelineBtn = screen.getByTestId("engine-pipeline");
    expect(pipelineBtn).toBeDisabled();
  });
});
