import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConferenceHeader } from "./conference-header";
import type { ConferenceSession, ConferenceSubState } from "@/types/conference";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("./sub-state-badge", () => ({
  SubStateBadge: ({ subState }: { subState: string }) => (
    <span data-testid="sub-state-badge">{subState}</span>
  ),
}));

function makeSession(overrides: Partial<ConferenceSession> = {}): ConferenceSession {
  return {
    id: "sess-1",
    userId: "user-1",
    scenarioId: "scen-1",
    status: "in_progress",
    sessionType: "conference",
    subState: "presenting",
    presentationTopic: "Drug Efficacy Study",
    audienceConfig: null,
    keyMessagesStatus: null,
    createdAt: null,
    ...overrides,
  };
}

describe("ConferenceHeader", () => {
  const defaultProps = {
    session: makeSession(),
    subState: "presenting" as ConferenceSubState,
    onEndSession: vi.fn(),
    onVoiceToggle: vi.fn(),
    voiceEnabled: false,
    featureVoiceEnabled: true,
    sessionTime: "05:30",
  };

  it("renders session time", () => {
    render(<ConferenceHeader {...defaultProps} />);
    expect(screen.getByText("05:30")).toBeInTheDocument();
  });

  it("renders presentation topic from session", () => {
    render(<ConferenceHeader {...defaultProps} />);
    expect(screen.getByText("Drug Efficacy Study")).toBeInTheDocument();
  });

  it("renders fallback title when session is undefined", () => {
    render(<ConferenceHeader {...defaultProps} session={undefined} />);
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("renders fallback title when presentationTopic is null", () => {
    render(
      <ConferenceHeader
        {...defaultProps}
        session={makeSession({ presentationTopic: null })}
      />,
    );
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("renders SubStateBadge with subState", () => {
    render(<ConferenceHeader {...defaultProps} subState="qa" />);
    expect(screen.getByTestId("sub-state-badge")).toHaveTextContent("qa");
  });

  it("renders end button and calls onEndSession", async () => {
    const onEndSession = vi.fn();
    render(<ConferenceHeader {...defaultProps} onEndSession={onEndSession} />);
    const endBtn = screen.getByText("endPresentation");
    await userEvent.click(endBtn);
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });

  it("renders voice toggle when featureVoiceEnabled is true", () => {
    render(<ConferenceHeader {...defaultProps} featureVoiceEnabled={true} />);
    expect(screen.getByText("voiceMode")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("does not render voice toggle when featureVoiceEnabled is false", () => {
    render(<ConferenceHeader {...defaultProps} featureVoiceEnabled={false} />);
    expect(screen.queryByText("voiceMode")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("calls onVoiceToggle when switch is toggled", async () => {
    const onVoiceToggle = vi.fn();
    render(
      <ConferenceHeader
        {...defaultProps}
        onVoiceToggle={onVoiceToggle}
        voiceEnabled={false}
      />,
    );
    const toggle = screen.getByRole("switch");
    await userEvent.click(toggle);
    expect(onVoiceToggle).toHaveBeenCalledWith(true);
  });
});
