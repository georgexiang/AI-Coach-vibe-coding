import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UserReportsPage from "./reports";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

// Mock recharts to avoid rendering actual SVG charts in jsdom
vi.mock("@/hooks/use-analytics", () => ({
  useDashboardStats: () => ({
    data: {
      total_sessions: 24,
      avg_score: 76.5,
      this_week: 3,
      improvement: 4.2,
    },
    isLoading: false,
  }),
  useDimensionTrends: () => ({
    data: [
      {
        session_date: "2026-03-20",
        overall_score: 78,
        dimensions: [
          { dimension: "Product Knowledge", score: 82 },
          { dimension: "Clinical Discussion", score: 75 },
          { dimension: "Objection Handling", score: 68 },
        ],
      },
      {
        session_date: "2026-03-10",
        overall_score: 72,
        dimensions: [
          { dimension: "Product Knowledge", score: 76 },
          { dimension: "Clinical Discussion", score: 70 },
          { dimension: "Objection Handling", score: 62 },
        ],
      },
    ],
    isLoading: false,
  }),
  useRecommendedScenarios: () => ({
    data: [
      {
        scenario_id: "s1",
        scenario_name: "Product Launch",
        product: "Zanubrutinib",
        difficulty: "Medium",
        reason: "Practice recommended",
      },
    ],
  }),
  useExportSessionsExcel: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/components/analytics", () => ({
  PerformanceRadar: () => <div data-testid="performance-radar" />,
  TrendLineChart: () => <div data-testid="trend-line-chart" />,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  RadarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="radar-chart">{children}</div>
  ),
  PolarGrid: () => <div />,
  PolarAngleAxis: () => <div />,
  PolarRadiusAxis: () => <div />,
  Radar: () => <div />,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div />,
}));

vi.mock("@/components/ui", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
  }) => <button onClick={onClick}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card">{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h3>{children}</h3>
  ),
  Tabs: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value: string;
  }) => (
    <div data-testid="tabs" data-value={value}>
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <button data-value={value}>{children}</button>,
  TabsContent: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`tab-content-${value}`}>{children}</div>,
}));

function renderReportsPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <UserReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UserReportsPage", () => {
  it("renders the page title", () => {
    renderReportsPage();
    expect(screen.getByText("Analytics & Reports")).toBeInTheDocument();
  });

  it("renders export buttons", () => {
    renderReportsPage();
    expect(screen.getByText("Print Report")).toBeInTheDocument();
    expect(screen.getByText("Export Excel")).toBeInTheDocument();
  });

  it("renders summary stat cards", () => {
    renderReportsPage();
    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("Avg Score")).toBeInTheDocument();
    expect(screen.getByText("76.5")).toBeInTheDocument();
  });

  it("renders chart sections", () => {
    renderReportsPage();
    expect(screen.getByText("Performance Trend")).toBeInTheDocument();
    expect(screen.getByText("Skill Radar")).toBeInTheDocument();
  });

  it("renders dimension data", () => {
    renderReportsPage();
    // PerformanceRadar and TrendLineChart are mocked
    expect(screen.getByTestId("performance-radar")).toBeInTheDocument();
    expect(screen.getByTestId("trend-line-chart")).toBeInTheDocument();
  });

  it("renders recommendations section", () => {
    renderReportsPage();
    expect(screen.getByText("Recommended Scenarios")).toBeInTheDocument();
    expect(screen.getByText("Product Launch")).toBeInTheDocument();
  });

  it("renders improvement stat", () => {
    renderReportsPage();
    expect(screen.getByText("Improvement")).toBeInTheDocument();
    expect(screen.getByText("+4.2")).toBeInTheDocument();
  });
});
