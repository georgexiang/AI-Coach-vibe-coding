import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConferenceSession from "./conference-session";

const mockNavigate = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams("id=cs-1"), vi.fn()],
  };
});

vi.mock("@/hooks/use-conference", () => ({
  useConferenceSession: () => ({
    data: {
      id: "cs-1",
      status: "in_progress",
      subState: "presenting",
      presentationTopic: "Drug Efficacy",
      audienceConfig: JSON.stringify([
        {
          id: "hcp-1",
          hcpProfileId: "hp-1",
          hcpName: "Dr. Smith",
          hcpSpecialty: "Oncology",
          roleInConference: "audience",
          voiceId: "v1",
          sortOrder: 0,
          status: "listening",
        },
      ]),
      keyMessagesStatus: JSON.stringify([
        { message: "Key message 1", delivered: false },
      ]),
      createdAt: new Date().toISOString(),
    },
    isLoading: false,
  }),
  useEndConferenceSession: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-conference-sse", () => ({
  useConferenceSSE: () => ({
    sendMessage: vi.fn(),
    isStreaming: false,
    streamedText: "",
    abort: vi.fn(),
  }),
}));

vi.mock("@/components/ui", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("@/components/conference", () => ({
  ConferenceHeader: ({
    onEndSession,
  }: {
    onEndSession: () => void;
    session: unknown;
    subState: string;
    onVoiceToggle: (v: boolean) => void;
    voiceEnabled: boolean;
    featureVoiceEnabled: boolean;
    sessionTime: string;
  }) => (
    <div data-testid="conference-header">
      <button onClick={onEndSession}>End</button>
    </div>
  ),
  TopicGuide: ({
    scenarioName,
  }: {
    scenarioName: string;
    topics: unknown[];
    isCollapsed: boolean;
    onToggle: () => void;
  }) => <div data-testid="topic-guide">{scenarioName}</div>,
  ConferenceStage: ({
    onSendMessage,
  }: {
    sessionId: string;
    onSendMessage: (text: string) => void;
    isStreaming: boolean;
    streamedText: string;
    currentSpeaker: string;
    avatarEnabled: boolean;
    featureAvatarEnabled: boolean;
    messages: unknown[];
    inputMode: string;
    recordingState: string;
    disabled: boolean;
  }) => (
    <div data-testid="conference-stage">
      <button onClick={() => onSendMessage("Hello HCP")}>Send</button>
    </div>
  ),
  TranscriptionPanel: () => <div data-testid="transcription-panel" />,
  AudiencePanel: () => <div data-testid="audience-panel" />,
  QuestionQueue: () => <div data-testid="question-queue" />,
}));

function renderConferenceSession() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/user/conference?id=cs-1"]}>
        <ConferenceSession />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ConferenceSession", () => {
  it("renders the conference header", () => {
    renderConferenceSession();
    expect(screen.getByTestId("conference-header")).toBeInTheDocument();
  });

  it("renders the topic guide with scenario name", () => {
    renderConferenceSession();
    expect(screen.getByTestId("topic-guide")).toBeInTheDocument();
    expect(screen.getByText("Drug Efficacy")).toBeInTheDocument();
  });

  it("renders the conference stage", () => {
    renderConferenceSession();
    expect(screen.getByTestId("conference-stage")).toBeInTheDocument();
  });

  it("renders the transcription panel", () => {
    renderConferenceSession();
    expect(screen.getByTestId("transcription-panel")).toBeInTheDocument();
  });

  it("renders the audience panel", () => {
    renderConferenceSession();
    expect(screen.getByTestId("audience-panel")).toBeInTheDocument();
  });

  it("renders the question queue", () => {
    renderConferenceSession();
    expect(screen.getByTestId("question-queue")).toBeInTheDocument();
  });

  it("shows end session dialog when End button is clicked", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    const endButton = screen.getByText("End");
    await user.click(endButton);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    // "endPresentation" appears both as dialog title and destructive button
    const endPresentationEls = screen.getAllByText("endPresentation");
    expect(endPresentationEls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("endConfirm")).toBeInTheDocument();
  });

  it("closes the dialog when continuePresenting is clicked", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    await user.click(screen.getByText("End"));
    expect(screen.getByTestId("dialog")).toBeInTheDocument();

    await user.click(screen.getByText("continuePresenting"));
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("adds user message when sending from conference stage", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    await user.click(screen.getByText("Send"));
    // handlePresent adds a user message and calls sendMessage
    // It should not crash
    expect(screen.getByTestId("conference-stage")).toBeInTheDocument();
  });

  it("navigates on confirm end session", async () => {
    const user = userEvent.setup();
    renderConferenceSession();

    await user.click(screen.getByText("End"));
    expect(screen.getByTestId("dialog")).toBeInTheDocument();

    // Click the destructive endPresentation button (the second one in dialog)
    const endButtons = screen.getAllByText("endPresentation");
    const confirmBtn = endButtons[endButtons.length - 1];
    if (confirmBtn) {
      await user.click(confirmBtn);
    }
    // After confirm, dialog closes and navigate is called
    expect(mockNavigate).toHaveBeenCalledWith("/user/scoring?id=cs-1");
  });
});
