import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SessionHistory from "./session-history";

const mockNavigate = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
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
  };
});

// Mock recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

vi.mock("@/components/analytics", () => ({
  PerformanceRadar: () => <div data-testid="performance-radar" />,
}));

vi.mock("@/components/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Input: ({
    placeholder,
    value,
    onChange,
  }: {
    placeholder?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
  }) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      data-testid="search-input"
    />
  ),
  Select: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value: string;
  }) => (
    <div data-testid="select" data-value={value}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: () => <span />,
}));

const mockHistoryData = [
  {
    session_id: "s1",
    scenario_name: "Dr. Sarah Mitchell",
    overall_score: 85,
    passed: true,
    completed_at: "2026-03-20T10:00:00Z",
    dimensions: [
      { dimension: "Knowledge", score: 88, weight: 0.3, improvement_pct: 5 },
      { dimension: "Communication", score: 82, weight: 0.3, improvement_pct: -2 },
    ],
  },
  {
    session_id: "s2",
    scenario_name: "Dr. James Wong",
    overall_score: 55,
    passed: false,
    completed_at: "2026-03-19T10:00:00Z",
    dimensions: [
      { dimension: "Knowledge", score: 60, weight: 0.3, improvement_pct: null },
      { dimension: "Communication", score: 50, weight: 0.3, improvement_pct: null },
    ],
  },
];

// We need to manage the mock before the component is imported, so we'll use a different approach
let mockScoreHistoryReturn: {
  data: typeof mockHistoryData | undefined;
  isLoading: boolean;
} = { data: mockHistoryData, isLoading: false };

vi.mock("@/hooks/use-scoring", () => ({
  useScoreHistory: () => mockScoreHistoryReturn,
}));

function renderSessionHistory() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SessionHistory />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SessionHistory", () => {
  it("renders the page title", () => {
    renderSessionHistory();
    expect(screen.getByText("history.title")).toBeInTheDocument();
  });

  it("renders session rows", () => {
    renderSessionHistory();
    expect(screen.getByText("Dr. Sarah Mitchell")).toBeInTheDocument();
    expect(screen.getByText("Dr. James Wong")).toBeInTheDocument();
  });

  it("renders overall scores", () => {
    renderSessionHistory();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("55")).toBeInTheDocument();
  });

  it("renders passed/failed badges", () => {
    renderSessionHistory();
    // "passed" and "failed" appear both in filter options and in table badges
    const passedEls = screen.getAllByText("passed");
    expect(passedEls.length).toBeGreaterThanOrEqual(2);
    const failedEls = screen.getAllByText("failed");
    expect(failedEls.length).toBeGreaterThanOrEqual(2);
  });

  it("renders the performance radar", () => {
    renderSessionHistory();
    expect(screen.getByTestId("performance-radar")).toBeInTheDocument();
  });

  it("renders the trend chart", () => {
    renderSessionHistory();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    renderSessionHistory();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("renders view details links", () => {
    renderSessionHistory();
    const viewDetails = screen.getAllByText("history.viewDetails");
    // 2 rows + 1 header
    expect(viewDetails.length).toBeGreaterThanOrEqual(2);
  });

  it("navigates to scoring page when row is clicked", async () => {
    const user = userEvent.setup();
    renderSessionHistory();

    const row = screen.getByText("Dr. Sarah Mitchell").closest("tr");
    expect(row).toBeTruthy();
    await user.click(row!);

    expect(mockNavigate).toHaveBeenCalledWith("/user/scoring/s1");
  });

  it("shows loading state", () => {
    mockScoreHistoryReturn = { data: undefined, isLoading: true };
    renderSessionHistory();
    // Loader2 renders an SVG with animate-spin class
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
    // Restore
    mockScoreHistoryReturn = { data: mockHistoryData, isLoading: false };
  });

  it("shows empty state when no history", () => {
    mockScoreHistoryReturn = { data: [], isLoading: false };
    renderSessionHistory();
    expect(screen.getByText("history.noSessions")).toBeInTheDocument();
    // Restore
    mockScoreHistoryReturn = { data: mockHistoryData, isLoading: false };
  });
});
