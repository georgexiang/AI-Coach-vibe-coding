import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminDashboard from "./dashboard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("@/components/shared/empty-state", () => ({
  EmptyState: () => <div data-testid="empty-state">EmptyState</div>,
}));

describe("AdminDashboard", () => {
  it("renders the dashboard heading", () => {
    render(<AdminDashboard />);

    // t("dashboard") returns "dashboard"
    const headings = screen.getAllByText("dashboard");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the card with dashboard title", () => {
    render(<AdminDashboard />);

    // Both the h1 and CardTitle use t("dashboard")
    const dashboardTexts = screen.getAllByText("dashboard");
    expect(dashboardTexts.length).toBe(2);
  });

  it("renders the empty state component", () => {
    render(<AdminDashboard />);

    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});
