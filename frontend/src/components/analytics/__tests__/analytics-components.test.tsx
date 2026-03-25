import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CompletionRate } from "../completion-rate";
import { SkillGapHeatmap } from "../skill-gap-heatmap";
import type { SkillGapCell } from "@/types/analytics";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

// Mock recharts - ResponsiveContainer does not render in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  RadarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="radar-chart">{children}</div>
  ),
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarRadiusAxis: () => <div data-testid="polar-radius-axis" />,
  Radar: ({ name }: { name: string }) => <div data-testid={`radar-${name}`} />,
  Tooltip: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Bar: ({ dataKey }: { dataKey: string }) => <div data-testid={`bar-${dataKey}`} />,
}));

describe("CompletionRate", () => {
  it("renders the rate percentage", () => {
    render(<CompletionRate rate={65} totalUsers={100} activeUsers={65} />);
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("shows active / total users text", () => {
    render(<CompletionRate rate={65} totalUsers={100} activeUsers={65} />);
    expect(screen.getByText(/65 \/ 100/)).toBeInTheDocument();
  });

  it("renders progress bar with correct width", () => {
    const { container } = render(
      <CompletionRate rate={75} totalUsers={200} activeUsers={150} />
    );
    const progressBar = container.querySelector("[style]");
    expect(progressBar).toBeTruthy();
    // The inner div has inline width style
    const innerBar = container.querySelector(".bg-primary");
    expect(innerBar).toHaveStyle({ width: "75%" });
  });

  it("caps progress bar at 100%", () => {
    const { container } = render(
      <CompletionRate rate={120} totalUsers={100} activeUsers={120} />
    );
    const innerBar = container.querySelector(".bg-primary");
    expect(innerBar).toHaveStyle({ width: "100%" });
  });

  it("handles zero rate", () => {
    render(<CompletionRate rate={0} totalUsers={100} activeUsers={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("SkillGapHeatmap", () => {
  const mockData: SkillGapCell[] = [
    { business_unit: "Oncology", dimension: "Knowledge", avg_score: 85 },
    { business_unit: "Oncology", dimension: "Communication", avg_score: 62 },
    { business_unit: "Hematology", dimension: "Knowledge", avg_score: 55 },
    { business_unit: "Hematology", dimension: "Communication", avg_score: 72 },
  ];

  it("renders table with BU rows", () => {
    render(<SkillGapHeatmap data={mockData} />);
    expect(screen.getByText("Oncology")).toBeInTheDocument();
    expect(screen.getByText("Hematology")).toBeInTheDocument();
  });

  it("renders dimension columns as headers", () => {
    render(<SkillGapHeatmap data={mockData} />);
    expect(screen.getByText("Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
  });

  it("renders score values in cells", () => {
    render(<SkillGapHeatmap data={mockData} />);
    expect(screen.getByText("85.0")).toBeInTheDocument();
    expect(screen.getByText("62.0")).toBeInTheDocument();
    expect(screen.getByText("55.0")).toBeInTheDocument();
    expect(screen.getByText("72.0")).toBeInTheDocument();
  });

  it("applies green color for scores >= 80", () => {
    render(<SkillGapHeatmap data={mockData} />);
    const highScore = screen.getByText("85.0");
    expect(highScore.className).toContain("bg-green");
  });

  it("applies red color for scores < 60", () => {
    render(<SkillGapHeatmap data={mockData} />);
    const lowScore = screen.getByText("55.0");
    expect(lowScore.className).toContain("bg-red");
  });

  it("applies orange color for scores 60-69", () => {
    render(<SkillGapHeatmap data={mockData} />);
    const midScore = screen.getByText("62.0");
    expect(midScore.className).toContain("bg-orange");
  });

  it("applies yellow color for scores 70-79", () => {
    render(<SkillGapHeatmap data={mockData} />);
    const midScore = screen.getByText("72.0");
    expect(midScore.className).toContain("bg-yellow");
  });

  it("shows noData message for empty data", () => {
    render(<SkillGapHeatmap data={[]} />);
    expect(screen.getByText("noData")).toBeInTheDocument();
  });
});
