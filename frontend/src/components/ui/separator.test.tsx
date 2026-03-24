import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Separator } from "./separator";

describe("Separator", () => {
  it("renders without crashing", () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders as horizontal by default", () => {
    const { container } = render(<Separator />);
    const sep = container.firstChild as HTMLElement;
    expect(sep).toHaveAttribute("data-orientation", "horizontal");
  });

  it("renders as vertical when specified", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const sep = container.firstChild as HTMLElement;
    expect(sep).toHaveAttribute("data-orientation", "vertical");
  });

  it("applies custom className", () => {
    const { container } = render(<Separator className="my-sep" />);
    const sep = container.firstChild as HTMLElement;
    expect(sep.className).toContain("my-sep");
  });
});
