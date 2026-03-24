import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders label text", () => {
    render(<StatusBadge status="delivered" label="Delivered" />);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });

  it("renders delivered status dot with correct class", () => {
    const { container } = render(<StatusBadge status="delivered" label="Done" />);
    const dot = container.querySelector(".bg-strength");
    expect(dot).toBeInTheDocument();
  });

  it("renders in-progress status dot with correct class", () => {
    const { container } = render(<StatusBadge status="in-progress" label="In Progress" />);
    const dot = container.querySelector(".bg-weakness");
    expect(dot).toBeInTheDocument();
  });

  it("renders pending status dot with correct class", () => {
    const { container } = render(<StatusBadge status="pending" label="Pending" />);
    const dot = container.querySelector(".bg-muted-foreground");
    expect(dot).toBeInTheDocument();
  });
});
