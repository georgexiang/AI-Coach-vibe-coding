import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DimensionBar } from "./dimension-bar";

describe("DimensionBar", () => {
  it("renders label and percentage", () => {
    render(<DimensionBar label="Communication" value={85} />);
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("calculates percentage from value and default maxValue of 100", () => {
    render(<DimensionBar label="Score" value={72} />);
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("calculates percentage from custom maxValue", () => {
    render(<DimensionBar label="Score" value={30} maxValue={50} />);
    // 30/50 = 60%
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("caps percentage at 100 when value exceeds maxValue", () => {
    render(<DimensionBar label="Overflow" value={150} maxValue={100} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("rounds percentage to nearest integer", () => {
    render(<DimensionBar label="Rounded" value={33} maxValue={100} />);
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("sets the progress bar width style based on percentage", () => {
    const { container } = render(
      <DimensionBar label="Width Test" value={45} />,
    );
    const progressBar = container.querySelector(
      ".bg-primary.transition-all",
    ) as HTMLElement;
    expect(progressBar).toBeInTheDocument();
    expect(progressBar.style.width).toBe("45%");
  });

  it("renders a zero-width bar when value is 0", () => {
    const { container } = render(
      <DimensionBar label="Empty" value={0} />,
    );
    const progressBar = container.querySelector(
      ".bg-primary.transition-all",
    ) as HTMLElement;
    expect(progressBar).toBeInTheDocument();
    expect(progressBar.style.width).toBe("0%");
  });

  it("renders the background track element", () => {
    const { container } = render(
      <DimensionBar label="Track" value={50} />,
    );
    const track = container.querySelector(".bg-primary\\/20");
    expect(track).toBeInTheDocument();
  });
});
