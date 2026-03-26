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
    expect(screen.getByText("Personal Reports")).toBeInTheDocument();
  });

  it("renders export buttons", () => {
    renderReportsPage();
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
    expect(screen.getByText("Export Excel")).toBeInTheDocument();
  });

  it("renders time period tabs", () => {
    renderReportsPage();
    expect(screen.getByText("Week")).toBeInTheDocument();
    expect(screen.getByText("Month")).toBeInTheDocument();
    expect(screen.getByText("Quarter")).toBeInTheDocument();
    expect(screen.getByText("Year")).toBeInTheDocument();
  });

  it("renders chart sections", () => {
    renderReportsPage();
    expect(screen.getAllByText("Score Trend").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Skill Radar").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Training Frequency").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Focus Areas").length).toBeGreaterThanOrEqual(1);
  });

  it("renders focus area cards", () => {
    renderReportsPage();
    expect(screen.getAllByText("Product Knowledge").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Clinical Discussion").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Objection Handling").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the tabs list", () => {
    renderReportsPage();
    expect(screen.getByTestId("tabs-list")).toBeInTheDocument();
  });

  it("renders multiple chart containers", () => {
    renderReportsPage();
    const containers = screen.getAllByTestId("responsive-container");
    // 3 charts (line, radar, bar) x 4 tabs = 12
    expect(containers.length).toBeGreaterThanOrEqual(3);
  });
});
