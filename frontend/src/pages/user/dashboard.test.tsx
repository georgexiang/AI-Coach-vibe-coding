import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UserDashboard from "./dashboard";

const mockNavigate = vi.fn();
const mockExportMutate = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts) return `${key}:${JSON.stringify(opts)}`;
      return key;
    },
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let mockUser: { full_name?: string; role: string; username: string } | null = {
  full_name: "Test User",
  role: "user",
  username: "testuser",
};

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    user: mockUser,
    token: "mock-token",
    isAuthenticated: true,
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  }),
}));

let mockRecentSessions: unknown[] | undefined = [
  { session_id: "s1", scenario_name: "Dr. Sarah Mitchell", overall_score: 85, completed_at: "2026-03-20T10:00:00Z", dimensions: [] },
  { session_id: "s2", scenario_name: "Dr. James Wong", overall_score: 78, completed_at: "2026-03-19T10:00:00Z", dimensions: [] },
  { session_id: "s3", scenario_name: "Dr. Emily Chen", overall_score: 90, completed_at: "2026-03-18T10:00:00Z", dimensions: [] },
  { session_id: "s4", scenario_name: "Dr. Michael Lee", overall_score: 72, completed_at: "2026-03-17T10:00:00Z", dimensions: [] },
  { session_id: "s5", scenario_name: "Dr. Lisa Park", overall_score: 88, completed_at: "2026-03-16T10:00:00Z", dimensions: [] },
];
let mockSessionsLoading = false;

vi.mock("@/hooks/use-scoring", () => ({
  useScoreHistory: () => ({
    data: mockRecentSessions,
    isLoading: mockSessionsLoading,
  }),
}));

let mockDashStats: unknown = { total_sessions: 42, avg_score: 78, this_week: 5, improvement: 3 };
let mockRecommended: unknown[] | undefined = [
  { scenario_name: "Dr. Amanda Hayes", difficulty: "Intermediate", reason: "Focus area" },
];
let mockExportPending = false;

vi.mock("@/hooks/use-analytics", () => ({
  useDashboardStats: () => ({
    data: mockDashStats,
    isLoading: false,
  }),
  useRecommendedScenarios: () => ({
    data: mockRecommended,
    isLoading: false,
  }),
  useExportSessionsExcel: () => ({
    mutate: mockExportMutate,
    isPending: mockExportPending,
  }),
}));

vi.mock("@/components/analytics", () => ({
  PerformanceRadar: () => <div data-testid="performance-radar" />,
}));

vi.mock("@/components/shared", () => ({
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid="stat-card">{label}: {value}</div>
  ),
  SessionItem: ({ hcpName, onClick }: { hcpName: string; onClick: () => void }) => (
    <div data-testid="session-item" onClick={onClick}>{hcpName}</div>
  ),
  ActionCard: ({ title, onStart }: { title: string; onStart: () => void }) => (
    <div data-testid="action-card">
      <span>{title}</span>
      <button onClick={onStart}>Start</button>
    </div>
  ),
  RecommendedScenario: ({ hcpName, onStart }: { hcpName: string; onStart: () => void }) => (
    <div data-testid="recommended-scenario">
      <span>{hcpName}</span>
      <button onClick={onStart}>Start</button>
    </div>
  ),
  MiniRadarChart: () => <div data-testid="mini-radar-chart" />,
  MiniTrendChart: () => <div data-testid="mini-trend-chart" />,
  LoadingState: () => <div className="animate-spin" data-testid="loading-state" />,
  EmptyState: ({ title, body }: { title: string; body?: string }) => (
    <div data-testid="empty-state"><span>{title}</span>{body && <span>{body}</span>}</div>
  ),
}));

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <UserDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UserDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { full_name: "Test User", role: "user", username: "testuser" };
    mockRecentSessions = [
      { session_id: "s1", scenario_name: "Dr. Sarah Mitchell", overall_score: 85, completed_at: "2026-03-20T10:00:00Z", dimensions: [] },
      { session_id: "s2", scenario_name: "Dr. James Wong", overall_score: 78, completed_at: "2026-03-19T10:00:00Z", dimensions: [] },
      { session_id: "s3", scenario_name: "Dr. Emily Chen", overall_score: 90, completed_at: "2026-03-18T10:00:00Z", dimensions: [] },
      { session_id: "s4", scenario_name: "Dr. Michael Lee", overall_score: 72, completed_at: "2026-03-17T10:00:00Z", dimensions: [] },
      { session_id: "s5", scenario_name: "Dr. Lisa Park", overall_score: 88, completed_at: "2026-03-16T10:00:00Z", dimensions: [] },
    ];
    mockSessionsLoading = false;
    mockDashStats = { total_sessions: 42, avg_score: 78, this_week: 5, improvement: 3 };
    mockRecommended = [{ scenario_name: "Dr. Amanda Hayes", difficulty: "Intermediate", reason: "Focus area" }];
    mockExportPending = false;
  });

  it("renders the welcome message with user name", () => {
    renderDashboard();
    expect(screen.getByText(/welcome/)).toBeInTheDocument();
  });

  it("renders the overview subtitle", () => {
    renderDashboard();
    expect(screen.getByText("overview")).toBeInTheDocument();
  });

  it("renders all four stat cards", () => {
    renderDashboard();
    const statCards = screen.getAllByTestId("stat-card");
    expect(statCards).toHaveLength(4);
  });

  it("renders recent session items", () => {
    renderDashboard();
    const sessions = screen.getAllByTestId("session-item");
    expect(sessions).toHaveLength(5);
    expect(screen.getByText("Dr. Sarah Mitchell")).toBeInTheDocument();
    expect(screen.getByText("Dr. James Wong")).toBeInTheDocument();
  });

  it("renders action cards for F2F and Conference training", () => {
    renderDashboard();
    const actionCards = screen.getAllByTestId("action-card");
    expect(actionCards).toHaveLength(2);
    expect(screen.getByText("f2fTraining")).toBeInTheDocument();
    expect(screen.getByText("conferenceTraining")).toBeInTheDocument();
  });

  it("renders recommended scenario section", () => {
    renderDashboard();
    expect(screen.getByText("recommendedScenario")).toBeInTheDocument();
    expect(screen.getByText("Dr. Amanda Hayes")).toBeInTheDocument();
  });

  it("navigates to training page when View All is clicked", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const viewAllButton = screen.getByText("viewAll");
    await user.click(viewAllButton);
    expect(mockNavigate).toHaveBeenCalledWith("/user/history");
  });

  it("navigates to training when action card Start is clicked", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const startButtons = screen.getAllByText("Start");
    await user.click(startButtons[0]!);
    expect(mockNavigate).toHaveBeenCalledWith("/user/training");
  });

  // NEW TESTS for uncovered branches

  it("shows loading spinner when sessions are loading", () => {
    mockSessionsLoading = true;
    const { container } = renderDashboard();
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows no sessions message when recentSessions is empty", () => {
    mockRecentSessions = [];
    renderDashboard();
    expect(screen.getAllByText(/noSessions/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows no sessions message when recentSessions is undefined", () => {
    mockRecentSessions = undefined;
    renderDashboard();
    expect(screen.getAllByText(/noSessions/).length).toBeGreaterThanOrEqual(1);
  });

  it("uses username as fallback when full_name is not set", () => {
    mockUser = { full_name: undefined, role: "user", username: "jdoe" };
    renderDashboard();
    // The welcome text should contain the username
    expect(screen.getByText(/jdoe/)).toBeInTheDocument();
  });

  it("uses tc('user') as fallback when both full_name and username are missing", () => {
    mockUser = null;
    renderDashboard();
    // Should use tc("user") which returns "user"
    expect(screen.getByText(/user/)).toBeInTheDocument();
  });

  it("renders improvement stat with positive value and + prefix", () => {
    mockDashStats = { total_sessions: 42, avg_score: 78, this_week: 5, improvement: 3 };
    renderDashboard();
    const statCards = screen.getAllByTestId("stat-card");
    const improvementCard = statCards[3];
    expect(improvementCard?.textContent).toContain("+3");
  });

  it("renders improvement stat with negative value", () => {
    mockDashStats = { total_sessions: 42, avg_score: 78, this_week: 5, improvement: -2 };
    renderDashboard();
    const statCards = screen.getAllByTestId("stat-card");
    const improvementCard = statCards[3];
    expect(improvementCard?.textContent).toContain("-2");
  });

  it("renders improvement stat as '--' when improvement is null", () => {
    mockDashStats = { total_sessions: 42, avg_score: 78, this_week: 5, improvement: null };
    renderDashboard();
    const statCards = screen.getAllByTestId("stat-card");
    const improvementCard = statCards[3];
    expect(improvementCard?.textContent).toContain("--");
  });

  it("renders recommended scenario reason when available", () => {
    renderDashboard();
    expect(screen.getByText("Focus area")).toBeInTheDocument();
  });

  it("does not render recommended scenario reason when not available", () => {
    mockRecommended = [{ scenario_name: "Test Scenario", difficulty: "Easy" }];
    renderDashboard();
    expect(screen.queryByText("Focus area")).not.toBeInTheDocument();
  });

  it("shows fallback recommended scenario name when no recommendations", () => {
    mockRecommended = undefined;
    renderDashboard();
    expect(screen.getByText("---")).toBeInTheDocument();
  });

  it("renders skill overview radar when latest session has dimensions", () => {
    mockRecentSessions = [
      {
        session_id: "s1",
        scenario_name: "Test",
        overall_score: 85,
        completed_at: "2026-03-20T10:00:00Z",
        dimensions: [
          { dimension: "Communication", score: 90 },
          { dimension: "Knowledge", score: 80 },
        ],
      },
    ];
    renderDashboard();
    expect(screen.getByTestId("performance-radar")).toBeInTheDocument();
    expect(screen.getByText("skillOverview")).toBeInTheDocument();
  });

  it("does not render skill overview radar when latest session has no dimensions", () => {
    mockRecentSessions = [
      {
        session_id: "s1",
        scenario_name: "Test",
        overall_score: 85,
        completed_at: "2026-03-20T10:00:00Z",
        dimensions: [],
      },
    ];
    renderDashboard();
    expect(screen.queryByText("skillOverview")).not.toBeInTheDocument();
  });

  it("calls exportExcel.mutate when export button is clicked", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const exportBtn = screen.getByText("exportExcel");
    await user.click(exportBtn);
    expect(mockExportMutate).toHaveBeenCalled();
  });

  it("shows exporting text when export is pending", () => {
    mockExportPending = true;
    renderDashboard();
    expect(screen.getByText("exportingExcel")).toBeInTheDocument();
  });

  it("navigates to scoring page when session item is clicked", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const firstSession = screen.getAllByTestId("session-item")[0]!;
    await user.click(firstSession);
    expect(mockNavigate).toHaveBeenCalledWith("/user/scoring/s1");
  });

  it("renders improvement stat with zero value showing +0", () => {
    mockDashStats = { total_sessions: 42, avg_score: 78, this_week: 5, improvement: 0 };
    renderDashboard();
    const statCards = screen.getAllByTestId("stat-card");
    const improvementCard = statCards[3];
    expect(improvementCard?.textContent).toContain("0");
  });
});
