import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubStateBadge } from "./sub-state-badge";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

describe("SubStateBadge", () => {
  it("returns null when subState is empty string", () => {
    const { container } = render(<SubStateBadge subState="" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders presenting label for presenting subState", () => {
    render(<SubStateBadge subState="presenting" />);
    expect(screen.getByText("subState.presenting")).toBeInTheDocument();
  });

  it("renders qa label for qa subState", () => {
    render(<SubStateBadge subState="qa" />);
    expect(screen.getByText("subState.qa")).toBeInTheDocument();
  });

  it("has aria-live assertive attribute", () => {
    render(<SubStateBadge subState="presenting" />);
    const badge = screen.getByText("subState.presenting");
    expect(badge).toHaveAttribute("aria-live", "assertive");
  });

  it("applies presenting styling for presenting subState", () => {
    render(<SubStateBadge subState="presenting" />);
    const badge = screen.getByText("subState.presenting");
    expect(badge.className).toContain("bg-primary/10");
    expect(badge.className).toContain("text-primary");
  });

  it("applies qa styling for qa subState", () => {
    render(<SubStateBadge subState="qa" />);
    const badge = screen.getByText("subState.qa");
    expect(badge.className).toContain("bg-orange-100");
    expect(badge.className).toContain("text-orange-600");
  });
});
