import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

describe("EmptyState", () => {
  it("renders with default title from translation key", () => {
    render(<EmptyState />);
    expect(screen.getByText("emptyState.title")).toBeInTheDocument();
  });

  it("renders with default body from translation key", () => {
    render(<EmptyState />);
    expect(screen.getByText("emptyState.body")).toBeInTheDocument();
  });

  it("renders with custom title", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders with custom body", () => {
    render(<EmptyState body="Try adjusting your filters" />);
    expect(
      screen.getByText("Try adjusting your filters"),
    ).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(<EmptyState action={<button>Create New</button>} />);
    expect(screen.getByText("Create New")).toBeInTheDocument();
  });

  it("does not render action section when not provided", () => {
    const { container } = render(<EmptyState />);
    // The action wrapper div should not be present
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(0);
  });

  it("renders the inbox icon", () => {
    const { container } = render(<EmptyState />);
    // lucide-react renders an SVG element
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });
});
