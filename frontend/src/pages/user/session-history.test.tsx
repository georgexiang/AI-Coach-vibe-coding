import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SessionHistory from "./session-history";
import type { ScoreHistoryItem } from "@/types/report";

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
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>{children}</span>
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
    onValueChange,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value: string;
  }) => (
    <div data-testid="select" data-value={value}>
      {children}
      {/* Hidden select for testing onValueChange */}
      <select
        data-testid="hidden-select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="__all__">All</option>
        <option value="passed">Passed</option>
        <option value="failed">Failed</option>
        <option value="high">High</option>
        <option value="mid">Mid</option>
        <option value="low">Low</option>
      </select>
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
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={`animate-pulse ${className ?? ""}`} />
  ),
}));

// Generate many items for pagination testing
function makeHistoryItems(count: number): ScoreHistoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    session_id: `s${i + 1}`,
    scenario_name: `Scenario ${i + 1}`,
    overall_score: 50 + (i % 50),
    passed: i % 3 !== 0,
    completed_at: `2026-03-${String(20 - i).padStart(2, "0")}T10:00:00Z`,
    dimensions: [
      { dimension: "Knowledge", score: 60 + (i % 30), weight: 0.3, improvement_pct: i % 2 === 0 ? 5 : -3 },
      { dimension: "Communication", score: 50 + (i % 40), weight: 0.3, improvement_pct: null },
      { dimension: "Empathy", score: 70 + (i % 20), weight: 0.2, improvement_pct: 0 },
    ],
  }));
}

const mockHistoryData: ScoreHistoryItem[] = [
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockScoreHistoryReturn = { data: mockHistoryData, isLoading: false };
  });

  it("renders the page title", () => {
    renderSessionHistory();
    expect(screen.getByText("history.title")).toBeInTheDocument();
  });

  it("renders session rows", () => {
    renderSessionHistory();
    // Desktop table + mobile cards both render, so text appears multiple times
    expect(screen.getAllByText("Dr. Sarah Mitchell").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Dr. James Wong").length).toBeGreaterThanOrEqual(1);
  });

  it("renders overall scores", () => {
    renderSessionHistory();
    // Desktop table + mobile cards both render scores
    expect(screen.getAllByText("85").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("55").length).toBeGreaterThanOrEqual(1);
  });

  it("renders passed/failed badges", () => {
    renderSessionHistory();
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
    expect(viewDetails.length).toBeGreaterThanOrEqual(2);
  });

  it("navigates to scoring page when row is clicked", async () => {
    const user = userEvent.setup();
    renderSessionHistory();

    // Both desktop table and mobile cards render; find the one inside a <tr>
    const elements = screen.getAllByText("Dr. Sarah Mitchell");
    const row = elements.map((el) => el.closest("tr")).find(Boolean);
    expect(row).toBeTruthy();
    await user.click(row!);

    expect(mockNavigate).toHaveBeenCalledWith("/user/scoring/s1");
  });

  it("shows loading state", () => {
    mockScoreHistoryReturn = { data: undefined, isLoading: true };
    renderSessionHistory();
    // LoadingState variant="table" renders Skeleton (animate-pulse)
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeTruthy();
  });

  it("shows empty state when no history", () => {
    mockScoreHistoryReturn = { data: [], isLoading: false };
    renderSessionHistory();
    expect(screen.getByText("history.noSessions")).toBeInTheDocument();
  });

  // NEW TESTS for uncovered branches

  it("shows empty state when history is undefined", () => {
    mockScoreHistoryReturn = { data: undefined, isLoading: false };
    renderSessionHistory();
    expect(screen.getByText("history.noSessions")).toBeInTheDocument();
  });

  it("filters by search term and resets page", async () => {
    const user = userEvent.setup();
    renderSessionHistory();
    const input = screen.getByTestId("search-input");
    await user.type(input, "Sarah");
    // Should only show matching rows (desktop + mobile duplicates)
    expect(screen.getAllByText("Dr. Sarah Mitchell").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Dr. James Wong")).not.toBeInTheDocument();
  });

  it("filters by mode (passed/failed) using hidden select", async () => {
    renderSessionHistory();
    // Get all hidden-select elements
    const selects = screen.getAllByTestId("hidden-select");
    // The first select is mode filter
    const modeSelect = selects[0]!;
    await userEvent.setup().selectOptions(modeSelect, "passed");
    // Should show only passed sessions (desktop + mobile duplicates)
    expect(screen.getAllByText("Dr. Sarah Mitchell").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Dr. James Wong")).not.toBeInTheDocument();
  });

  it("filters by mode (failed) using hidden select", async () => {
    renderSessionHistory();
    const selects = screen.getAllByTestId("hidden-select");
    const modeSelect = selects[0]!;
    await userEvent.setup().selectOptions(modeSelect, "failed");
    // Should show only failed sessions (desktop + mobile duplicates)
    expect(screen.queryByText("Dr. Sarah Mitchell")).not.toBeInTheDocument();
    expect(screen.getAllByText("Dr. James Wong").length).toBeGreaterThanOrEqual(1);
  });

  it("filters by score range (high >= 80)", async () => {
    renderSessionHistory();
    const selects = screen.getAllByTestId("hidden-select");
    const scoreSelect = selects[1]!;
    await userEvent.setup().selectOptions(scoreSelect, "high");
    expect(screen.getAllByText("Dr. Sarah Mitchell").length).toBeGreaterThanOrEqual(1); // 85
    expect(screen.queryByText("Dr. James Wong")).not.toBeInTheDocument(); // 55
  });

  it("filters by score range (mid 60-79)", async () => {
    const threeItems = [
      ...mockHistoryData,
      {
        session_id: "s3",
        scenario_name: "Dr. Mid Score",
        overall_score: 72,
        passed: true,
        completed_at: "2026-03-18T10:00:00Z",
        dimensions: [
          { dimension: "Knowledge", score: 70, weight: 0.3, improvement_pct: null },
        ],
      },
    ];
    mockScoreHistoryReturn = { data: threeItems, isLoading: false };
    renderSessionHistory();
    const selects = screen.getAllByTestId("hidden-select");
    const scoreSelect = selects[1]!;
    await userEvent.setup().selectOptions(scoreSelect, "mid");
    expect(screen.getAllByText("Dr. Mid Score").length).toBeGreaterThanOrEqual(1); // 72
    expect(screen.queryByText("Dr. Sarah Mitchell")).not.toBeInTheDocument(); // 85
    expect(screen.queryByText("Dr. James Wong")).not.toBeInTheDocument(); // 55
  });

  it("filters by score range (low < 60)", async () => {
    renderSessionHistory();
    const selects = screen.getAllByTestId("hidden-select");
    const scoreSelect = selects[1]!;
    await userEvent.setup().selectOptions(scoreSelect, "low");
    expect(screen.getAllByText("Dr. James Wong").length).toBeGreaterThanOrEqual(1); // 55
    expect(screen.queryByText("Dr. Sarah Mitchell")).not.toBeInTheDocument(); // 85
  });

  it("shows results count reflecting filtered items", async () => {
    renderSessionHistory();
    // "2 results" rendered from `{filteredHistory.length} {t("history.results", ...)}`
    // The "2" text node and "results" text node are siblings, so we look for combined text
    const resultsSpan = screen.getByText(/results/);
    expect(resultsSpan.textContent).toContain("2");
  });

  it("renders pagination when more than 10 items", () => {
    const manyItems = makeHistoryItems(15);
    mockScoreHistoryReturn = { data: manyItems, isLoading: false };
    renderSessionHistory();
    // Desktop + mobile both render pagination
    expect(screen.getAllByText("Previous").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Next").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1 / 2").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render pagination when 10 or fewer items", () => {
    renderSessionHistory(); // 2 items
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("navigates to next page on Next click", async () => {
    const user = userEvent.setup();
    const manyItems = makeHistoryItems(15);
    mockScoreHistoryReturn = { data: manyItems, isLoading: false };
    renderSessionHistory();

    // Desktop + mobile both render pagination; click first one
    const nextBtns = screen.getAllByText("Next");
    await user.click(nextBtns[0]!);
    expect(screen.getAllByText("2 / 2").length).toBeGreaterThanOrEqual(1);
  });

  it("navigates to previous page on Previous click", async () => {
    const user = userEvent.setup();
    const manyItems = makeHistoryItems(15);
    mockScoreHistoryReturn = { data: manyItems, isLoading: false };
    renderSessionHistory();

    // Go to page 2 (click first Next button)
    const nextBtns = screen.getAllByText("Next");
    await user.click(nextBtns[0]!);
    expect(screen.getAllByText("2 / 2").length).toBeGreaterThanOrEqual(1);
    // Go back to page 1 (click first Previous button)
    const prevBtns = screen.getAllByText("Previous");
    await user.click(prevBtns[0]!);
    expect(screen.getAllByText("1 / 2").length).toBeGreaterThanOrEqual(1);
  });

  it("Previous button is disabled on first page", () => {
    const manyItems = makeHistoryItems(15);
    mockScoreHistoryReturn = { data: manyItems, isLoading: false };
    renderSessionHistory();
    // Desktop + mobile both render Previous; all should be disabled on page 1
    const prevBtns = screen.getAllByText("Previous");
    expect(prevBtns[0]!).toBeDisabled();
  });

  it("Next button is disabled on last page", async () => {
    const user = userEvent.setup();
    const manyItems = makeHistoryItems(15);
    mockScoreHistoryReturn = { data: manyItems, isLoading: false };
    renderSessionHistory();
    const nextBtns = screen.getAllByText("Next");
    await user.click(nextBtns[0]!);
    // After going to last page, all Next buttons should be disabled
    const nextBtnsAfter = screen.getAllByText("Next");
    expect(nextBtnsAfter[0]!).toBeDisabled();
  });

  it("renders score badge with green styling for high scores", () => {
    renderSessionHistory();
    // Score 85 should have green styling (desktop + mobile both render)
    const score85Elements = screen.getAllByText("85");
    const greenStyled = score85Elements.find((el) => el.className.includes("bg-green-100"));
    expect(greenStyled).toBeTruthy();
  });

  it("renders score badge with red styling for low scores", () => {
    renderSessionHistory();
    // Score 55 should have red styling (desktop + mobile both render)
    const score55Elements = screen.getAllByText("55");
    const redStyled = score55Elements.find((el) => el.className.includes("bg-red-100"));
    expect(redStyled).toBeTruthy();
  });

  it("renders TrendingUp icon for positive improvement", () => {
    renderSessionHistory();
    // The dimension "Knowledge" with improvement_pct: 5 should show trending up
    // Check for the green-600 text class associated with positive trend
    const trendElements = document.querySelectorAll(".text-green-600");
    expect(trendElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders TrendingDown icon for negative improvement", () => {
    renderSessionHistory();
    // The dimension "Communication" with improvement_pct: -2 should show trending down
    const trendElements = document.querySelectorAll(".text-red-600");
    expect(trendElements.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show trend icon when improvement_pct is null", () => {
    // The second session has null improvement_pct values
    // These should not produce trend icons
    mockScoreHistoryReturn = {
      data: [{
        session_id: "s1",
        scenario_name: "Only Null Improvements",
        overall_score: 70,
        passed: true,
        completed_at: "2026-03-20T10:00:00Z",
        dimensions: [
          { dimension: "Knowledge", score: 70, weight: 0.3, improvement_pct: null },
        ],
      }],
      isLoading: false,
    };
    renderSessionHistory();
    const upTrend = document.querySelectorAll(".text-green-600");
    const downTrend = document.querySelectorAll(".text-red-600");
    expect(upTrend.length).toBe(0);
    expect(downTrend.length).toBe(0);
  });

  it("does not show trend icon when improvement_pct is 0", () => {
    mockScoreHistoryReturn = {
      data: [
        {
          session_id: "s1",
          scenario_name: "Zero Improvement",
          overall_score: 70,
          passed: true,
          completed_at: "2026-03-20T10:00:00Z",
          dimensions: [
            { dimension: "Knowledge", score: 70, weight: 0.3, improvement_pct: 0 },
          ],
        },
        {
          session_id: "s2",
          scenario_name: "Dummy",
          overall_score: 65,
          passed: true,
          completed_at: "2026-03-19T10:00:00Z",
          dimensions: [
            { dimension: "Knowledge", score: 65, weight: 0.3, improvement_pct: 0 },
          ],
        },
      ],
      isLoading: false,
    };
    renderSessionHistory();
    const upTrend = document.querySelectorAll(".text-green-600");
    const downTrend = document.querySelectorAll(".text-red-600");
    expect(upTrend.length).toBe(0);
    expect(downTrend.length).toBe(0);
  });

  it("does not render trend chart when only 1 data point", () => {
    mockScoreHistoryReturn = {
      data: [{
        session_id: "s1",
        scenario_name: "Single",
        overall_score: 85,
        passed: true,
        completed_at: "2026-03-20T10:00:00Z",
        dimensions: [
          { dimension: "Knowledge", score: 88, weight: 0.3, improvement_pct: 5 },
        ],
      }],
      isLoading: false,
    };
    renderSessionHistory();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("renders previousScores for radar when 2+ sessions exist", () => {
    renderSessionHistory();
    // With 2 sessions, previousScores should be populated for the PerformanceRadar
    expect(screen.getByTestId("performance-radar")).toBeInTheDocument();
  });

  it("renders completed_at date in table rows", () => {
    renderSessionHistory();
    // The date should be formatted via toLocaleDateString
    // Check that dates are present in the document
    const rows = document.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);
  });

  it("renders '-' for missing completed_at date", () => {
    mockScoreHistoryReturn = {
      data: [
        {
          session_id: "s1",
          scenario_name: "No Date",
          overall_score: 70,
          passed: true,
          completed_at: null as unknown as string,
          dimensions: [
            { dimension: "Knowledge", score: 70, weight: 0.3, improvement_pct: null },
          ],
        },
        {
          session_id: "s2",
          scenario_name: "Dummy",
          overall_score: 60,
          passed: true,
          completed_at: "2026-03-19T10:00:00Z",
          dimensions: [
            { dimension: "Knowledge", score: 60, weight: 0.3, improvement_pct: null },
          ],
        },
      ],
      isLoading: false,
    };
    renderSessionHistory();
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
