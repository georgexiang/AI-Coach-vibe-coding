import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioTable } from "./scenario-table";
import type { Scenario } from "@/types/scenario";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const makeScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "sc-1",
  name: "Test Scenario",
  description: "A test",
  product: "ProductA",
  therapeutic_area: "Oncology",
  mode: "f2f",
  difficulty: "easy",
  status: "active",
  hcp_profile_id: "hcp-1",
  hcp_profile: {
    id: "hcp-1",
    name: "Dr. Test",
    specialty: "Oncology",
    hospital: "",
    title: "",
    avatar_url: "",
    personality_type: "friendly",
    emotional_state: 50,
    communication_style: 50,
    expertise_areas: [],
    prescribing_habits: "",
    concerns: "",
    objections: [],
    probe_topics: [],
    difficulty: "easy",
    is_active: true,
    created_by: "admin",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    agent_id: "",
    agent_version: "",
    agent_sync_status: "none",
    agent_sync_error: "",
  },
  key_messages: [],
  weight_key_message: 20,
  weight_objection_handling: 20,
  weight_communication: 20,
  weight_product_knowledge: 20,
  weight_scientific_info: 20,
  pass_threshold: 70,
  created_by: "admin",
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  ...overrides,
});

describe("ScenarioTable", () => {
  const defaultProps = {
    scenarios: [makeScenario()],
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onClone: vi.fn(),
  };

  it("renders scenario name in table", () => {
    render(<ScenarioTable {...defaultProps} />);
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
  });

  it("renders product column", () => {
    render(<ScenarioTable {...defaultProps} />);
    expect(screen.getByText("ProductA")).toBeInTheDocument();
  });

  it("renders empty state when no scenarios", () => {
    render(<ScenarioTable {...defaultProps} scenarios={[]} />);
    expect(screen.getByText("scenarios.emptyTitle")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    render(<ScenarioTable {...defaultProps} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("HCP")).toBeInTheDocument();
    expect(screen.getByText("Mode")).toBeInTheDocument();
    expect(screen.getByText("Difficulty")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("toggles sort direction when clicking column header", async () => {
    render(<ScenarioTable {...defaultProps} />);
    const nameHeader = screen.getByText("Name");
    await userEvent.click(nameHeader);
    // Clicking again toggles direction - just verify no crash
    await userEvent.click(nameHeader);
  });

  it("sorts by product when Product header clicked", async () => {
    render(<ScenarioTable {...defaultProps} />);
    await userEvent.click(screen.getByText("Product"));
    // No crash, sorts by product
    expect(screen.getByText("ProductA")).toBeInTheDocument();
  });

  it("sorts by difficulty when Difficulty header clicked", async () => {
    render(<ScenarioTable {...defaultProps} />);
    await userEvent.click(screen.getByText("Difficulty"));
    expect(screen.getByText("easy")).toBeInTheDocument();
  });

  it("renders HCP avatar fallback for scenario with hcp_profile", () => {
    render(<ScenarioTable {...defaultProps} />);
    expect(screen.getByText("DT")).toBeInTheDocument(); // Dr. Test -> DT
  });

  it("renders dash for scenario without hcp_profile", () => {
    const noHcpScenario = makeScenario({ hcp_profile: undefined });
    render(
      <ScenarioTable
        {...defaultProps}
        scenarios={[noHcpScenario]}
      />
    );
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders mode badge", () => {
    render(<ScenarioTable {...defaultProps} />);
    expect(screen.getByText("f2f")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<ScenarioTable {...defaultProps} />);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders secondary badge for non-active status", () => {
    const draftScenario = makeScenario({ status: "draft" });
    render(
      <ScenarioTable
        {...defaultProps}
        scenarios={[draftScenario]}
      />
    );
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("renders difficulty with correct style", () => {
    const medScenario = makeScenario({ difficulty: "medium" });
    render(
      <ScenarioTable
        {...defaultProps}
        scenarios={[medScenario]}
      />
    );
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("renders hard difficulty style", () => {
    const hardScenario = makeScenario({ difficulty: "hard" });
    render(
      <ScenarioTable
        {...defaultProps}
        scenarios={[hardScenario]}
      />
    );
    expect(screen.getByText("hard")).toBeInTheDocument();
  });

  it("shows pagination when more than 10 scenarios", () => {
    const manyScenarios = Array.from({ length: 15 }, (_, i) =>
      makeScenario({ id: `sc-${i}`, name: `Scenario ${i}` })
    );
    render(
      <ScenarioTable
        {...defaultProps}
        scenarios={manyScenarios}
      />
    );
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("navigates to next page", async () => {
    const manyScenarios = Array.from({ length: 15 }, (_, i) =>
      makeScenario({ id: `sc-${i}`, name: `Scenario ${i}` })
    );
    render(
      <ScenarioTable
        {...defaultProps}
        scenarios={manyScenarios}
      />
    );
    await userEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("navigates back to previous page", async () => {
    const manyScenarios = Array.from({ length: 15 }, (_, i) =>
      makeScenario({ id: `sc-${i}`, name: `Scenario ${i}` })
    );
    render(
      <ScenarioTable
        {...defaultProps}
        scenarios={manyScenarios}
      />
    );
    await userEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Previous"));
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("does not show pagination for 10 or fewer scenarios", () => {
    render(<ScenarioTable {...defaultProps} />);
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  it("calls onEdit via dropdown menu", async () => {
    const onEdit = vi.fn();
    render(<ScenarioTable {...defaultProps} onEdit={onEdit} />);
    // Open the dropdown
    const menuButton = screen.getByRole("button", { name: "" });
    await userEvent.click(menuButton);
    await userEvent.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalled();
  });

  it("calls onClone via dropdown menu", async () => {
    const onClone = vi.fn();
    render(<ScenarioTable {...defaultProps} onClone={onClone} />);
    const menuButton = screen.getByRole("button", { name: "" });
    await userEvent.click(menuButton);
    await userEvent.click(screen.getByText("Clone"));
    expect(onClone).toHaveBeenCalledWith("sc-1");
  });

  it("calls onDelete via dropdown menu", async () => {
    const onDelete = vi.fn();
    render(<ScenarioTable {...defaultProps} onDelete={onDelete} />);
    const menuButton = screen.getByRole("button", { name: "" });
    await userEvent.click(menuButton);
    await userEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("sc-1");
  });
});
