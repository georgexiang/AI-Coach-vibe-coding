import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "./stat-card";
import { BarChart } from "lucide-react";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Total Sessions" value={42} />);
    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<StatCard label="Average" value="87%" />);
    expect(screen.getByText("87%")).toBeInTheDocument();
  });

  it("renders trend when provided", () => {
    render(
      <StatCard label="Score" value={90} trend={{ value: "+12%", direction: "up" }} />,
    );
    expect(screen.getByText("+12%")).toBeInTheDocument();
  });

  it("renders progress bar when progress provided", () => {
    render(
      <StatCard label="Goal" value={7} progress={{ current: 7, total: 10 }} />,
    );
    expect(screen.getByText("7 of 10 goal")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    const { container } = render(
      <StatCard label="Test" value={1} icon={BarChart} />,
    );
    // icon wrapper div should exist
    expect(container.querySelector(".bg-primary\\/10")).toBeInTheDocument();
  });
});
