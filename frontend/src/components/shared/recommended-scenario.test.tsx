import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecommendedScenario } from "./recommended-scenario";

describe("RecommendedScenario", () => {
  const defaultProps = {
    hcpName: "Dr. Zhang",
    difficulty: "Medium",
    onStart: vi.fn(),
  };

  it("renders HCP name and practice text", () => {
    render(<RecommendedScenario {...defaultProps} />);
    expect(screen.getByText("Dr. Zhang")).toBeInTheDocument();
    expect(screen.getByText("Practice with Dr. Zhang")).toBeInTheDocument();
  });

  it("renders the first letter of hcpName as avatar initial", () => {
    render(<RecommendedScenario {...defaultProps} />);
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("uppercases the avatar initial for lowercase names", () => {
    render(
      <RecommendedScenario {...defaultProps} hcpName="alice" />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders difficulty badge", () => {
    render(<RecommendedScenario {...defaultProps} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("renders Easy difficulty with green styling", () => {
    const { container } = render(
      <RecommendedScenario {...defaultProps} difficulty="Easy" />,
    );
    const badges = container.querySelectorAll("[data-slot='badge']");
    const difficultyBadge = Array.from(badges).find(
      (b) => b.textContent === "Easy",
    );
    expect(difficultyBadge?.className).toContain("bg-green-100");
  });

  it("renders Hard difficulty with red styling", () => {
    const { container } = render(
      <RecommendedScenario {...defaultProps} difficulty="Hard" />,
    );
    const badges = container.querySelectorAll("[data-slot='badge']");
    const difficultyBadge = Array.from(badges).find(
      (b) => b.textContent === "Hard",
    );
    expect(difficultyBadge?.className).toContain("bg-red-100");
  });

  it("renders fallback styling for unknown difficulty", () => {
    const { container } = render(
      <RecommendedScenario {...defaultProps} difficulty="Expert" />,
    );
    const badges = container.querySelectorAll("[data-slot='badge']");
    const difficultyBadge = Array.from(badges).find(
      (b) => b.textContent === "Expert",
    );
    expect(difficultyBadge?.className).toContain("bg-muted");
  });

  it("renders Start Training button and triggers onStart callback", async () => {
    const onStart = vi.fn();
    render(<RecommendedScenario {...defaultProps} onStart={onStart} />);
    const button = screen.getByRole("button", { name: /start training/i });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("renders without onStart prop (optional)", () => {
    render(<RecommendedScenario hcpName="Dr. Li" difficulty="Easy" />);
    expect(screen.getByText("Dr. Li")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start training/i })).toBeInTheDocument();
  });
});
