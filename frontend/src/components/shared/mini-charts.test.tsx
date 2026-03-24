import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MiniRadarChart, MiniTrendChart } from "./mini-charts";

describe("MiniRadarChart", () => {
  it("renders an SVG with aria-hidden", () => {
    const { container } = render(<MiniRadarChart />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders a polygon element", () => {
    const { container } = render(<MiniRadarChart />);
    const polygon = container.querySelector("polygon");
    expect(polygon).toBeInTheDocument();
  });
});

describe("MiniTrendChart", () => {
  it("renders an SVG with aria-hidden", () => {
    const { container } = render(<MiniTrendChart />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders a polyline element", () => {
    const { container } = render(<MiniTrendChart />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeInTheDocument();
  });
});
