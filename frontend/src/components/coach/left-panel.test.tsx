import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeftPanel } from "./left-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

describe("LeftPanel", () => {
  const defaultProps = {
    isCollapsed: false,
    onToggleCollapse: vi.fn(),
    scenarioProduct: "TestProduct",
    scenarioContext: "Test context description",
    hcpName: "Dr. John Smith",
    hcpSpecialty: "Oncology",
    hcpPersonality: "Analytical",
    hcpBackground: "15 years experience",
    keyMessages: [
      { id: "1", label: "Efficacy data", checked: false },
      { id: "2", label: "Safety profile", checked: true },
    ],
    onToggleKeyMessage: vi.fn(),
    scoringCriteria: [
      { label: "Key Message", weight: 30 },
      { label: "Communication", weight: 25 },
    ],
  };

  it("renders HCP name and specialty when expanded", () => {
    render(<LeftPanel {...defaultProps} />);
    expect(screen.getByText("Dr. John Smith")).toBeInTheDocument();
    expect(screen.getByText("Oncology")).toBeInTheDocument();
  });

  it("renders scenario product and context", () => {
    render(<LeftPanel {...defaultProps} />);
    expect(screen.getByText("TestProduct")).toBeInTheDocument();
    expect(screen.getByText("Test context description")).toBeInTheDocument();
  });

  it("renders key messages", () => {
    render(<LeftPanel {...defaultProps} />);
    expect(screen.getByText("Efficacy data")).toBeInTheDocument();
    expect(screen.getByText("Safety profile")).toBeInTheDocument();
  });

  it("renders scoring criteria with weights", () => {
    render(<LeftPanel {...defaultProps} />);
    expect(screen.getByText("Key Message")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("renders collapsed state with expand button", () => {
    render(<LeftPanel {...defaultProps} isCollapsed />);
    expect(screen.queryByText("Dr. John Smith")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ariaExpandLeft")).toBeInTheDocument();
  });

  it("calls onToggleCollapse when collapse button is clicked", async () => {
    const onToggle = vi.fn();
    render(<LeftPanel {...defaultProps} onToggleCollapse={onToggle} />);
    await userEvent.click(screen.getByLabelText("ariaCollapseLeft"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
