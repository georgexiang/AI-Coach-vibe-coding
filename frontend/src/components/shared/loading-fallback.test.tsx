import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LoadingFallback } from "./loading-fallback";

describe("LoadingFallback", () => {
  it("renders a container div with min-h and centering classes", () => {
    const { container } = render(<LoadingFallback />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("min-h-[200px]");
    expect(wrapper.className).toContain("items-center");
    expect(wrapper.className).toContain("justify-center");
  });

  it("renders the Loader2 spinner with animate-spin", () => {
    const { container } = render(<LoadingFallback />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.classList.contains("animate-spin")).toBe(true);
  });

  it("renders the spinner with size-6 class", () => {
    const { container } = render(<LoadingFallback />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("size-6")).toBe(true);
  });

  it("matches snapshot structure", () => {
    const { container } = render(<LoadingFallback />);
    // Should be a single wrapper with a single SVG child
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.children.length).toBe(1);
    expect(wrapper.children[0]?.tagName).toBe("svg");
  });
});
