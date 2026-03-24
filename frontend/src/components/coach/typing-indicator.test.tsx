import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TypingIndicator } from "./typing-indicator";

describe("TypingIndicator", () => {
  it("renders with aria-label", () => {
    render(<TypingIndicator />);
    expect(screen.getByLabelText("HCP is typing")).toBeInTheDocument();
  });

  it("renders three bouncing dots", () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll(".animate-bounce");
    expect(dots).toHaveLength(3);
  });

  it("applies staggered animation delays", () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll(".animate-bounce");
    expect(dots[0]).toHaveStyle({ animationDelay: "0ms" });
    expect(dots[1]).toHaveStyle({ animationDelay: "150ms" });
    expect(dots[2]).toHaveStyle({ animationDelay: "300ms" });
  });
});
