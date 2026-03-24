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
  it("renders the loading text from translation key", () => {
    render(<LoadingState />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders skeleton elements", () => {
    const { container } = render(<LoadingState />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBe(2);
  });

  it("renders with proper layout classes", () => {
    const { container } = render(<LoadingState />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("items-center");
    expect(wrapper.className).toContain("justify-center");
  });
});
