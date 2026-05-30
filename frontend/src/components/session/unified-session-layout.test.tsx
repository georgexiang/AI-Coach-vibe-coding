import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnifiedSessionLayout } from "./unified-session-layout";

describe("UnifiedSessionLayout", () => {
  it("renders header, left panel, and right panel", () => {
    render(
      <UnifiedSessionLayout
        header={<div data-testid="header">Header</div>}
        leftPanel={<div data-testid="left">Left</div>}
        rightPanel={<div data-testid="right">Right</div>}
      />,
    );

    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("left")).toBeInTheDocument();
    expect(screen.getByTestId("right")).toBeInTheDocument();
  });

  it("uses h-screen for full viewport height", () => {
    const { container } = render(
      <UnifiedSessionLayout
        header={<div>H</div>}
        leftPanel={<div>L</div>}
        rightPanel={<div>R</div>}
      />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("h-screen");
  });

  it("renders guidance cards when provided", () => {
    render(
      <UnifiedSessionLayout
        header={<div>H</div>}
        leftPanel={<div>L</div>}
        rightPanel={<div>R</div>}
        guidanceCards={<div data-testid="guidance">Guide</div>}
      />,
    );

    expect(screen.getByTestId("guidance")).toBeInTheDocument();
  });

  it("does not render guidance cards container when not provided", () => {
    const { container } = render(
      <UnifiedSessionLayout
        header={<div>H</div>}
        leftPanel={<div>L</div>}
        rightPanel={<div>R</div>}
      />,
    );

    expect(container.querySelector("[class*='z-50']")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <UnifiedSessionLayout
        header={<div>H</div>}
        leftPanel={<div>L</div>}
        rightPanel={<div>R</div>}
        className="custom-class"
      />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("custom-class");
  });
});
