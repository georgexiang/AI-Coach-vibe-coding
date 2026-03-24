import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Toaster } from "./sonner";

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => (
    <div data-testid="sonner-toaster" data-theme={props.theme}>
      Toaster
    </div>
  ),
}));

describe("Toaster", () => {
  it("renders without crashing", () => {
    const { container } = render(<Toaster />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders with light theme by default", () => {
    const { getByTestId } = render(<Toaster />);
    expect(getByTestId("sonner-toaster")).toHaveAttribute("data-theme", "light");
  });

  it("passes custom theme prop", () => {
    const { getByTestId } = render(<Toaster theme="dark" />);
    expect(getByTestId("sonner-toaster")).toHaveAttribute("data-theme", "dark");
  });
});
