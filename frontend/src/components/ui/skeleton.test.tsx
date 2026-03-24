import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("has data-slot attribute", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("data-slot", "skeleton");
  });

  it("applies custom className", () => {
    const { container } = render(<Skeleton className="w-32 h-4" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("w-32");
    expect(el.className).toContain("h-4");
  });

  it("applies animate-pulse class by default", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("animate-pulse");
  });
});
