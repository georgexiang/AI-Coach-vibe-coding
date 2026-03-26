import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UserDashboard from "./dashboard";

const mockNavigate = vi.fn();

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

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    user: { full_name: "Test User", role: "user", username: "testuser" },
    token: "mock-token",
    isAuthenticated: true,
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-scoring", () => ({
  useScoreHistory: () => ({
    data: [
      { session_id: "s1", scenario_name: "Dr. Sarah Mitchell", overall_score: 85, completed_at: "2026-03-20T10:00:00Z", dimensions: [] },
      { session_id: "s2", scenario_name: "Dr. James Wong", overall_score: 78, completed_at: "2026-03-19T10:00:00Z", dimensions: [] },
      { session_id: "s3", scenario_name: "Dr. Emily Chen", overall_score: 90, completed_at: "2026-03-18T10:00:00Z", dimensions: [] },
      { session_id: "s4", scenario_name: "Dr. Michael Lee", overall_score: 72, completed_at: "2026-03-17T10:00:00Z", dimensions: [] },
      { session_id: "s5", scenario_name: "Dr. Lisa Park", overall_score: 88, completed_at: "2026-03-16T10:00:00Z", dimensions: [] },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-analytics", () => ({
  useDashboardStats: () => ({
    data: { total_sessions: 42, avg_score: 78, this_week: 5, improvement: 3 },
    isLoading: false,
  }),
  useRecommendedScenarios: () => ({
    data: [{ scenario_name: "Dr. Amanda Hayes", difficulty: "Intermediate", reason: "Focus area" }],
    isLoading: false,
  }),
  useExportSessionsExcel: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/components/analytics", () => ({
  PerformanceRadar: () => <div data-testid="performance-radar" />,
}));

vi.mock("@/components/shared", () => ({
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid="stat-card">{label}: {value}</div>
  ),
  SessionItem: ({ hcpName }: { hcpName: string }) => (
    <div data-testid="session-item">{hcpName}</div>
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
});
