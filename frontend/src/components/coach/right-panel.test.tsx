import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RightPanel } from "./right-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

describe("RightPanel", () => {
  const defaultProps = {
    isCollapsed: false,
    onToggleCollapse: vi.fn(),
    hints: [
      { id: "1", text: "Ask about side effects" },
      { id: "2", text: "Mention clinical trial data" },
    ],
    messageStatuses: [
      { id: "1", label: "Efficacy", status: "delivered" as const },
      { id: "2", label: "Safety", status: "pending" as const },
    ],
    sessionTime: "12:30",
    wordCount: 150,
  };

  it("renders hints when expanded", () => {
    render(<RightPanel {...defaultProps} />);
    expect(screen.getByText("Ask about side effects")).toBeInTheDocument();
    expect(screen.getByText("Mention clinical trial data")).toBeInTheDocument();
  });

  it("renders session stats", () => {
    render(<RightPanel {...defaultProps} />);
    expect(screen.getByText("12:30")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("renders message statuses", () => {
    render(<RightPanel {...defaultProps} />);
    expect(screen.getByText("Efficacy")).toBeInTheDocument();
    expect(screen.getByText("Safety")).toBeInTheDocument();
  });

  it("renders collapsed state with expand button", () => {
    render(<RightPanel {...defaultProps} isCollapsed />);
    expect(screen.queryByText("Ask about side effects")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ariaExpandRight")).toBeInTheDocument();
  });

  it("calls onToggleCollapse when clicked", async () => {
    const onToggle = vi.fn();
    render(<RightPanel {...defaultProps} onToggleCollapse={onToggle} />);
    await userEvent.click(screen.getByLabelText("ariaCollapseRight"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
