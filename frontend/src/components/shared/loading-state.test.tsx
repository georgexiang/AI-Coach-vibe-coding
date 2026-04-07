import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

import { LoadingState } from "./loading-state";

describe("LoadingState", () => {
  // Default (spinner) variant
  it("renders the loading text from translation key", () => {
    render(<LoadingState />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders skeleton elements for default spinner variant", () => {
    const { container } = render(<LoadingState />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBe(2);
  });

  it("renders with proper layout classes for default variant", () => {
    const { container } = render(<LoadingState />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("items-center");
    expect(wrapper.className).toContain("justify-center");
  });

  it("renders spinner variant explicitly", () => {
    render(<LoadingState variant="spinner" />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("spinner variant has min-h-[200px] class", () => {
    const { container } = render(<LoadingState variant="spinner" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("min-h-[200px]");
  });

  // Card variant
  it("renders card variant with grid of skeleton cards", () => {
    const { container } = render(<LoadingState variant="card" />);
    // Card variant renders a grid
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("grid");
    expect(wrapper.className).toContain("grid-cols-1");
  });

  it("card variant renders 6 skeleton card items", () => {
    const { container } = render(<LoadingState variant="card" />);
    const cardItems = container.querySelectorAll(".overflow-hidden.rounded-lg");
    expect(cardItems.length).toBe(6);
  });

  it("card variant does not show loading text", () => {
    render(<LoadingState variant="card" />);
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("card variant renders skeletons for image and text placeholders", () => {
    const { container } = render(<LoadingState variant="card" />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    // Each of 6 cards has: 1 image skeleton + 3 text skeletons = 4 per card = 24 total
    expect(skeletons.length).toBe(24);
  });

  // Table variant
  it("renders table variant with list of skeleton rows", () => {
    const { container } = render(<LoadingState variant="table" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("space-y-3");
  });

  it("table variant renders 6 skeleton rows (1 header + 5 body rows)", () => {
    const { container } = render(<LoadingState variant="table" />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBe(6);
  });

  it("table variant does not show loading text", () => {
    render(<LoadingState variant="table" />);
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("table variant renders rounded-lg skeletons", () => {
    const { container } = render(<LoadingState variant="table" />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    for (const skeleton of skeletons) {
      expect((skeleton as HTMLElement).className).toContain("rounded-lg");
    }
  });
});
