import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renders without crashing", () => {
    render(<Checkbox aria-label="test checkbox" />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Checkbox className="custom-class" aria-label="test" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.className).toContain("custom-class");
  });

  it("renders as checked when checked prop is true", () => {
    render(<Checkbox checked aria-label="test" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("renders as unchecked by default", () => {
    render(<Checkbox aria-label="test" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });
});
