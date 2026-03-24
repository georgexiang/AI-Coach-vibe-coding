import { render, screen } from "@testing-library/react";
import { RadarChart } from "./radar-chart";

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  RadarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="radar-chart" data-length={data.length}>
      {children}
    </div>
  ),
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarRadiusAxis: () => <div data-testid="polar-radius-axis" />,
  Radar: ({ name, dataKey }: { name: string; dataKey: string }) => (
    <div data-testid={`radar-${dataKey}`} data-name={name} />
  ),
}));

describe("RadarChart", () => {
  const currentScores = [
    { dimension: "Communication", score: 85 },
    { dimension: "Product Knowledge", score: 70 },
    { dimension: "Scientific Info", score: 60 },
  ];

  it("renders the chart container", () => {
    render(<RadarChart currentScores={currentScores} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("radar-chart")).toBeInTheDocument();
  });

  it("passes merged data with correct number of dimensions", () => {
    render(<RadarChart currentScores={currentScores} />);
    const chart = screen.getByTestId("radar-chart");
    expect(chart).toHaveAttribute("data-length", "3");
  });

  it("renders current radar when no previous scores", () => {
    render(<RadarChart currentScores={currentScores} />);
    expect(screen.getByTestId("radar-current")).toBeInTheDocument();
    expect(screen.queryByTestId("radar-previous")).not.toBeInTheDocument();
  });

  it("renders both current and previous radars when previous scores provided", () => {
    const previousScores = [
      { dimension: "Communication", score: 75 },
      { dimension: "Product Knowledge", score: 60 },
      { dimension: "Scientific Info", score: 50 },
    ];

    render(
      <RadarChart
        currentScores={currentScores}
        previousScores={previousScores}
      />,
    );
    expect(screen.getByTestId("radar-current")).toBeInTheDocument();
    expect(screen.getByTestId("radar-previous")).toBeInTheDocument();
  });
});
