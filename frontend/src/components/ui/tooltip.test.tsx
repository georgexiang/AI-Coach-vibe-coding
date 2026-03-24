import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tooltip, TooltipTrigger, TooltipProvider } from "./tooltip";

describe("Tooltip", () => {
  it("renders trigger content", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  it("renders within TooltipProvider without crashing", () => {
    const { container } = render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Test Trigger</TooltipTrigger>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(container).toBeInTheDocument();
  });
});
