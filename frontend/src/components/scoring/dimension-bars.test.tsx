import { render, screen } from "@testing-library/react";
import { DimensionBars } from "./dimension-bars";
import type { ScoreDetail } from "@/types/score";

function makeDetail(dimension: string, score: number): ScoreDetail {
  return {
    dimension,
    score,
    weight: 20,
    strengths: [],
    weaknesses: [],
    suggestions: [],
  };
}

describe("DimensionBars", () => {
  it("renders all dimension names and scores", () => {
    const details = [
      makeDetail("Communication", 85),
      makeDetail("Product Knowledge", 65),
    ];

    render(<DimensionBars details={details} />);

    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("Product Knowledge")).toBeInTheDocument();
    expect(screen.getByText("65")).toBeInTheDocument();
  });

  it("applies green color for scores >= 80", () => {
    const details = [makeDetail("High Score", 90)];
    const { container } = render(<DimensionBars details={details} />);

    const bar = container.querySelector(".bg-green-500");
    expect(bar).toBeInTheDocument();
  });

  it("applies orange color for scores 60-79", () => {
    const details = [makeDetail("Mid Score", 70)];
    const { container } = render(<DimensionBars details={details} />);

    const bar = container.querySelector(".bg-orange-500");
    expect(bar).toBeInTheDocument();
  });

  it("applies red color for scores < 60", () => {
    const details = [makeDetail("Low Score", 45)];
    const { container } = render(<DimensionBars details={details} />);

    const bar = container.querySelector(".bg-red-500");
    expect(bar).toBeInTheDocument();
  });

  it("renders progressbar with correct aria attributes", () => {
    const details = [makeDetail("Test", 75)];
    render(<DimensionBars details={details} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "75");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
  });
});
