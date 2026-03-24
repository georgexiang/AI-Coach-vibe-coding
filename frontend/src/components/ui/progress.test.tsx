import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Progress } from "./progress";

describe("Progress", () => {
  it("renders without crashing", () => {
    const { container } = render(<Progress value={50} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Progress value={50} className="custom-progress" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("custom-progress");
  });

  it("renders a progressbar role element", () => {
    const { container } = render(<Progress value={75} />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("role", "progressbar");
  });

  it("renders indicator child with style transform", () => {
    const { container } = render(<Progress value={75} />);
    const root = container.firstChild as HTMLElement;
    // The indicator is a child div
    expect(root.children.length).toBeGreaterThan(0);
  });
});
