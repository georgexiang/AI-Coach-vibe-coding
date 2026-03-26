import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminDashboard from "./dashboard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("@/hooks/use-analytics", () => ({
  useOrgAnalytics: () => ({
    data: {
      total_users: 50,
      active_users: 30,
      total_sessions: 200,
      avg_org_score: 75,
      completion_rate: 0.6,
      bu_stats: [],
      skill_gaps: [],
    },
    isLoading: false,
  }),
}));

vi.mock("@/components/shared", () => ({
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid="stat-card">{label}: {value}</div>
  ),
}));

vi.mock("@/components/analytics", () => ({
  BuComparisonBar: () => <div data-testid="bu-comparison" />,
  SkillGapHeatmap: () => <div data-testid="skill-gap" />,
  CompletionRate: () => <div data-testid="completion-rate" />,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminDashboard />
    </QueryClientProvider>,
  );
}

describe("AdminDashboard", () => {
  it("renders the admin dashboard heading", () => {
    renderDashboard();
    expect(screen.getByText("adminDashboard")).toBeInTheDocument();
  });

  it("renders four stat cards", () => {
    renderDashboard();
    const statCards = screen.getAllByTestId("stat-card");
    expect(statCards).toHaveLength(4);
  });

  it("renders completion rate card", () => {
    renderDashboard();
    expect(screen.getByText("completionRate")).toBeInTheDocument();
    expect(screen.getByTestId("completion-rate")).toBeInTheDocument();
  });

  it("renders bu comparison and score distribution sections", () => {
    renderDashboard();
    expect(screen.getByText("buComparison")).toBeInTheDocument();
    expect(screen.getByText("Score Distribution")).toBeInTheDocument();
  });

  it("renders skill gap heatmap section", () => {
    renderDashboard();
    expect(screen.getByText("skillGapHeatmap")).toBeInTheDocument();
  });

  it("renders top performers and needs attention sections", () => {
    renderDashboard();
    expect(screen.getByText("Top Performers")).toBeInTheDocument();
    expect(screen.getByText("Needs Attention")).toBeInTheDocument();
  });
});
