import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreCard } from "./score-card";

describe("ScoreCard", () => {
  it("renders score and label", () => {
    render(<ScoreCard score={85} label="Overall Score" />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("Overall Score")).toBeInTheDocument();
  });

  it("renders trend with up direction", () => {
    render(
      <ScoreCard score={90} label="Score" trend={{ value: "+5%", direction: "up" }} />,
    );
    expect(screen.getByText("+5%")).toBeInTheDocument();
  });

  it("renders trend with down direction", () => {
    render(
      <ScoreCard score={70} label="Score" trend={{ value: "-3%", direction: "down" }} />,
    );
    expect(screen.getByText("-3%")).toBeInTheDocument();
  });

  it("renders without trend when not provided", () => {
    const { container } = render(<ScoreCard score={80} label="Test" />);
    expect(container.querySelector(".text-strength")).not.toBeInTheDocument();
  });

  it("renders custom chart when provided", () => {
    render(
      <ScoreCard score={88} label="Test" chart={<div data-testid="custom-chart" />} />,
    );
    expect(screen.getByTestId("custom-chart")).toBeInTheDocument();
  });
});
