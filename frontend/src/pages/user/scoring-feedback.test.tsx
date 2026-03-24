import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScoringFeedback from "./scoring-feedback";

const mockNavigate = vi.fn();
const mockMutate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams("id=session-1")],
}));

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

let sessionData: unknown = { status: "scored" };
let scoreData: unknown = mockScore;
let scoreLoading = false;

vi.mock("@/hooks/use-scoring", () => ({
  useSessionScore: () => ({ data: scoreData, isLoading: scoreLoading }),
  useTriggerScoring: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: sessionData }),
}));

// Mock child scoring components to simplify
vi.mock("@/components/scoring/score-summary", () => ({
  ScoreSummary: (props: { overallScore: number; passed: boolean }) => (
    <div data-testid="score-summary">Score: {props.overallScore} {props.passed ? "PASS" : "FAIL"}</div>
  ),
}));
vi.mock("@/components/scoring/radar-chart", () => ({
  RadarChart: () => <div data-testid="radar-chart" />,
}));
vi.mock("@/components/scoring/dimension-bars", () => ({
  DimensionBars: () => <div data-testid="dimension-bars" />,
}));
vi.mock("@/components/scoring/feedback-card", () => ({
  FeedbackCard: (props: { detail: { dimension: string } }) => (
    <div data-testid="feedback-card">{props.detail.dimension}</div>
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
    sessionData = { status: "scored" };
    scoreData = mockScore;
    scoreLoading = false;
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
});
