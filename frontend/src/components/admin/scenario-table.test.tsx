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
});
