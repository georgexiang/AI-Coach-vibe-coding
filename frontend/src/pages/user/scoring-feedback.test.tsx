import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScoringFeedback from "./scoring-feedback";

const mockNavigate = vi.fn();
const mockMutate = vi.fn();
const mockPrint = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ sessionId: "session-1" }),
    useSearchParams: () => [new URLSearchParams("id=session-1")],
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const mockScore = {
  overall_score: 82,
  passed: true,
  details: [
    {
      dimension: "Communication",
      score: 85,
      weight: 30,
      strengths: ["clear"],
      weaknesses: ["speed"],
      suggestions: ["slow down"],
    },
    {
      dimension: "Product Knowledge",
      score: 78,
      weight: 25,
      strengths: ["detail"],
      weaknesses: [],
      suggestions: ["study more"],
    },
  ],
};

let sessionData: unknown = { status: "scored", scenario_id: "sc-1", created_at: "2026-03-20T10:00:00Z" };
let scoreData: unknown = mockScore;
let scoreLoading = false;
let reportData: unknown = undefined;
let historyData: unknown = undefined;

vi.mock("@/hooks/use-scoring", () => ({
  useSessionScore: () => ({ data: scoreData, isLoading: scoreLoading }),
  useTriggerScoring: () => ({ mutate: mockMutate, isPending: false }),
  useScoreHistory: () => ({ data: historyData, isLoading: false }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: sessionData }),
}));

vi.mock("@/hooks/use-reports", () => ({
  useSessionReport: () => ({ data: reportData, isLoading: false }),
}));

// Mock child scoring components to simplify
vi.mock("@/components/scoring/score-summary", () => ({
  ScoreSummary: (props: { overallScore: number; passed: boolean }) => (
    <div data-testid="score-summary">Score: {props.overallScore} {props.passed ? "PASS" : "FAIL"}</div>
  ),
}));
vi.mock("@/components/scoring/radar-chart", () => ({
  RadarChart: (props: { previousScores?: unknown }) => (
    <div data-testid="radar-chart" data-has-previous={props.previousScores ? "true" : "false"} />
  ),
}));
vi.mock("@/components/scoring/dimension-bars", () => ({
  DimensionBars: () => <div data-testid="dimension-bars" />,
}));
vi.mock("@/components/scoring/feedback-card", () => ({
  FeedbackCard: (props: { detail: { dimension: string } }) => (
    <div data-testid="feedback-card">{props.detail.dimension}</div>
  ),
}));
vi.mock("@/components/scoring/report-section", () => ({
  ReportSection: (props: { improvements: string[]; keyMessagesDelivered: number; keyMessagesTotal: number }) => (
    <div data-testid="report-section">
      {props.improvements.join(",")} {props.keyMessagesDelivered}/{props.keyMessagesTotal}
    </div>
  ),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ScoringFeedback />
    </QueryClientProvider>
  );
}

describe("ScoringFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionData = { status: "scored", scenario_id: "sc-1", created_at: "2026-03-20T10:00:00Z" };
    scoreData = mockScore;
    scoreLoading = false;
    reportData = undefined;
    historyData = undefined;
    // Mock window.print
    Object.defineProperty(window, "print", { value: mockPrint, writable: true });
  });

  it("renders loading state when score is loading", () => {
    scoreLoading = true;
    scoreData = undefined;
    renderPage();
    expect(screen.getByText("scoringInProgress")).toBeInTheDocument();
  });

  it("renders loading state when score is null", () => {
    scoreData = undefined;
    renderPage();
    expect(screen.getByText("scoringInProgress")).toBeInTheDocument();
  });

  it("renders score summary when score is available", () => {
    renderPage();
    expect(screen.getByTestId("score-summary")).toHaveTextContent("Score: 82 PASS");
  });

  it("renders radar chart and dimension bars", () => {
    renderPage();
    expect(screen.getByTestId("radar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("dimension-bars")).toBeInTheDocument();
  });

  it("renders feedback cards for each dimension", () => {
    renderPage();
    const cards = screen.getAllByTestId("feedback-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Communication");
    expect(cards[1]).toHaveTextContent("Product Knowledge");
  });

  it("renders action buttons", () => {
    renderPage();
    expect(screen.getByText("tryAgain")).toBeInTheDocument();
    expect(screen.getByText("exportPdf")).toBeInTheDocument();
    expect(screen.getByText("backToDashboard")).toBeInTheDocument();
  });

  it("navigates to training on tryAgain click", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("tryAgain"));
    expect(mockNavigate).toHaveBeenCalledWith("/user/training");
  });

  it("navigates to dashboard on backToDashboard click", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("backToDashboard"));
    expect(mockNavigate).toHaveBeenCalledWith("/user/dashboard");
  });

  it("renders page title", () => {
    renderPage();
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  // NEW TESTS for uncovered branches

  it("triggers scoring when session is completed but not scored", () => {
    sessionData = { status: "completed" };
    scoreData = undefined;
    scoreLoading = false;
    renderPage();
    expect(mockMutate).toHaveBeenCalledWith("session-1");
  });

  it("does not trigger scoring when session is already scored", () => {
    sessionData = { status: "scored" };
    scoreData = mockScore;
    renderPage();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("renders session metadata when session data is available", () => {
    renderPage();
    expect(screen.getByText(/scenario/i)).toBeInTheDocument();
    expect(screen.getByText(/sc-1/)).toBeInTheDocument();
  });

  it("renders circular progress ring with overall score", () => {
    renderPage();
    // The SVG text element contains "82"
    const scoreTexts = screen.getAllByText("82");
    expect(scoreTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("calls window.print when exportPdf is clicked", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("exportPdf"));
    expect(mockPrint).toHaveBeenCalled();
  });

  it("renders report section when report data is available", () => {
    reportData = {
      improvements: ["focus on communication", "handle objections better"],
      key_messages_delivered: 3,
      key_messages_total: 5,
    };
    renderPage();
    expect(screen.getByTestId("report-section")).toBeInTheDocument();
    expect(screen.getByText("report.improvementTitle")).toBeInTheDocument();
  });

  it("does not render report section when report data is undefined", () => {
    reportData = undefined;
    renderPage();
    expect(screen.queryByTestId("report-section")).not.toBeInTheDocument();
  });

  it("passes previousScores to RadarChart when history contains a previous session", () => {
    historyData = [
      {
        session_id: "session-1",
        dimensions: [
          { dimension: "Communication", score: 85 },
          { dimension: "Product Knowledge", score: 78 },
        ],
      },
      {
        session_id: "session-0",
        dimensions: [
          { dimension: "Communication", score: 75 },
          { dimension: "Product Knowledge", score: 70 },
        ],
      },
    ];
    renderPage();
    const radar = screen.getByTestId("radar-chart");
    expect(radar).toHaveAttribute("data-has-previous", "true");
  });

  it("passes undefined previousScores when current session is the only one in history", () => {
    historyData = [
      {
        session_id: "session-1",
        dimensions: [
          { dimension: "Communication", score: 85 },
        ],
      },
    ];
    renderPage();
    const radar = screen.getByTestId("radar-chart");
    expect(radar).toHaveAttribute("data-has-previous", "false");
  });

  it("passes undefined previousScores when history is empty", () => {
    historyData = undefined;
    renderPage();
    const radar = screen.getByTestId("radar-chart");
    expect(radar).toHaveAttribute("data-has-previous", "false");
  });

  it("renders shareWithManager button as disabled", () => {
    renderPage();
    const shareBtn = screen.getByText("shareWithManager");
    expect(shareBtn.closest("button")).toBeDisabled();
  });
});
