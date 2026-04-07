import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionCard } from "./action-card";
import { Zap } from "lucide-react";

describe("ActionCard", () => {
  const defaultProps = {
    title: "Start Training",
    description: "Begin a new coaching session",
    icon: Zap,
    gradient: "blue" as const,
    onStart: vi.fn(),
  };

  it("renders title and description", () => {
    render(<ActionCard {...defaultProps} />);
    expect(screen.getByText("Start Training")).toBeInTheDocument();
    expect(screen.getByText("Begin a new coaching session")).toBeInTheDocument();
  });

  it("renders start button and triggers onStart callback", async () => {
    const onStart = vi.fn();
    render(<ActionCard {...defaultProps} onStart={onStart} />);
    const button = screen.getByRole("button", { name: /start/i });
    await userEvent.click(button);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("applies purple gradient classes when gradient is purple", () => {
    const { container } = render(
      <ActionCard {...defaultProps} gradient="purple" />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("from-improvement");
  });

  it("applies blue gradient classes when gradient is blue", () => {
    const { container } = render(
      <ActionCard {...defaultProps} gradient="blue" />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("from-primary");
  });
});
