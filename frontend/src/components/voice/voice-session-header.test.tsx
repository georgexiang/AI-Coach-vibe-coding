import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceSessionHeader } from "./voice-session-header";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("@/components/coach/session-timer", () => ({
  SessionTimer: ({ startedAt }: { startedAt: string | null }) => (
    <div data-testid="session-timer">{startedAt ?? "no-time"}</div>
  ),
}));

vi.mock("./connection-status", () => ({
  ConnectionStatus: ({ state }: { state: string }) => (
    <div data-testid="connection-status">{state}</div>
  ),
}));

describe("VoiceSessionHeader", () => {
  const defaultProps = {
    scenarioTitle: "Drug Efficacy Discussion",
    mode: "voice_pipeline" as const,
    connectionState: "connected" as const,
    onEndSession: vi.fn(),
    startedAt: "2026-03-27T08:00:00Z",
  };

  it("renders scenario title text", () => {
    render(<VoiceSessionHeader {...defaultProps} />);
    expect(screen.getByText("Drug Efficacy Discussion")).toBeInTheDocument();
  });

  it("renders mode badge with translated mode text", () => {
    render(<VoiceSessionHeader {...defaultProps} mode="digital_human_pipeline" />);
    expect(screen.getByText("modeBadge.digital_human_pipeline")).toBeInTheDocument();
  });

  it("renders ConnectionStatus component with correct state", () => {
    render(<VoiceSessionHeader {...defaultProps} connectionState="connecting" />);
    const status = screen.getByTestId("connection-status");
    expect(status).toHaveTextContent("connecting");
  });

  it("renders End Session button with destructive styling", () => {
    render(<VoiceSessionHeader {...defaultProps} />);
    const endBtn = screen.getByTestId("end-session-btn");
    expect(endBtn).toBeInTheDocument();
    expect(endBtn).toHaveTextContent("endSession");
  });

  it("calls onEndSession when End Session button is clicked", async () => {
    const onEndSession = vi.fn();
    render(<VoiceSessionHeader {...defaultProps} onEndSession={onEndSession} />);
    const endBtn = screen.getByTestId("end-session-btn");
    await userEvent.click(endBtn);
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });

  it("renders view toggle button when onToggleView is provided", () => {
    const onToggleView = vi.fn();
    render(
      <VoiceSessionHeader {...defaultProps} onToggleView={onToggleView} />,
    );
    const toggleBtn = screen.getByLabelText("fullScreen");
    expect(toggleBtn).toBeInTheDocument();
  });

  it("does not render view toggle button when onToggleView is not provided", () => {
    render(<VoiceSessionHeader {...defaultProps} />);
    expect(screen.queryByLabelText("fullScreen")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("embeddedView")).not.toBeInTheDocument();
  });

  it("renders SessionTimer component", () => {
    render(<VoiceSessionHeader {...defaultProps} />);
    expect(screen.getByTestId("session-timer")).toBeInTheDocument();
  });

  it("applies full-screen styling when isFullScreen is true", () => {
    const { container } = render(
      <VoiceSessionHeader
        {...defaultProps}
        isFullScreen={true}
        onToggleView={vi.fn()}
      />,
    );
    const header = container.querySelector("header");
    expect(header?.className).toContain("bg-black/50");
  });
});
