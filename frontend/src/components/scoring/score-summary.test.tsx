import { render, screen } from "@testing-library/react";
import { ScoreSummary } from "./score-summary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && "n" in opts) return `${key} ${opts.n}`;
      return key;
    },
    i18n: { language: "en-US" },
  }),
}));

describe("ScoreSummary", () => {
  it("renders overall score and PASS badge", () => {
    render(<ScoreSummary overallScore={85} passed={true} />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("PASS")).toBeInTheDocument();
  });

  it("renders FAIL badge when not passed", () => {
    render(<ScoreSummary overallScore={45} passed={false} />);
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("FAIL")).toBeInTheDocument();
  });

  it("renders excellent grade for scores >= 80", () => {
    render(<ScoreSummary overallScore={80} passed={true} />);
    expect(screen.getByText("grades.excellent")).toBeInTheDocument();
  });

  it("renders needsImprovement grade for scores < 60", () => {
    render(<ScoreSummary overallScore={50} passed={false} />);
    expect(screen.getByText("grades.needsImprovement")).toBeInTheDocument();
  });

  it("shows trend up with positive trend value", () => {
    render(<ScoreSummary overallScore={85} passed={true} trend={5} />);
    expect(screen.getByText("trendUp 5")).toBeInTheDocument();
  });

  it("shows trend down with negative trend value", () => {
    render(<ScoreSummary overallScore={70} passed={true} trend={-3} />);
    expect(screen.getByText("trendDown 3")).toBeInTheDocument();
  });

  it("does not show trend when trend is zero", () => {
    render(<ScoreSummary overallScore={75} passed={true} trend={0} />);
    expect(screen.queryByText(/trendUp/)).not.toBeInTheDocument();
    expect(screen.queryByText(/trendDown/)).not.toBeInTheDocument();
  });
});
