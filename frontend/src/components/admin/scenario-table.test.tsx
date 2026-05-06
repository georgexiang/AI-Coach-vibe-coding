import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ScenarioTable } from "./scenario-table";
import type { Scenario } from "@/types/scenario";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
  tags: ["product:ProductA", "therapeutic_area:Oncology"],
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
    voice_name: "en-US-AvaNeural",
    voice_type: "azure-standard",
    voice_temperature: 0.9,
    voice_custom: false,
    avatar_character: "lori",
    avatar_style: "casual",
    avatar_customized: false,
    turn_detection_type: "server_vad",
    noise_suppression: false,
    echo_cancellation: false,
    eou_detection: false,
    recognition_language: "auto",
    agent_instructions_override: "",
    knowledge_config_count: 0,
    voice_live_enabled: true,
    voice_live_model: "gpt-4o",
    voice_live_instance_id: null,
  },
  key_messages: [],
  rubric_id: "rubric-1",
  pass_threshold: 70,
  created_by: "admin",
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  skill_id: "skill-1",
  skill_version_id: null,
  ...overrides,
});

function renderTable(props: Partial<React.ComponentProps<typeof ScenarioTable>> = {}) {
  const defaultProps = {
    scenarios: [makeScenario()],
    onDelete: vi.fn(),
    onClone: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <ScenarioTable {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

describe("ScenarioTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders scenario name in table", () => {
    renderTable();
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
  });

  it("renders tags column with tag badges", () => {
    renderTable();
    expect(screen.getByText("ProductA")).toBeInTheDocument();
    expect(screen.getByText("Oncology")).toBeInTheDocument();
  });

  it("renders empty state when no scenarios", () => {
    renderTable({ scenarios: [] });
    expect(screen.getByText("scenarios.emptyTitle")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    renderTable();
    expect(screen.getByText("scenarios.colName")).toBeInTheDocument();
    expect(screen.getByText("scenarios.tags")).toBeInTheDocument();
    expect(screen.getByText("HCP")).toBeInTheDocument();
    expect(screen.getByText("Mode")).toBeInTheDocument();
    expect(screen.getByText("Difficulty")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("toggles sort direction when clicking column header", async () => {
    renderTable();
    const nameHeader = screen.getByText("scenarios.colName");
    await userEvent.click(nameHeader);
    await userEvent.click(nameHeader);
  });

  it("sorts by difficulty when Difficulty header clicked", async () => {
    renderTable();
    await userEvent.click(screen.getByText("Difficulty"));
    expect(screen.getByText("easy")).toBeInTheDocument();
  });

  it("renders HCP avatar fallback for scenario with hcp_profile", () => {
    renderTable();
    expect(screen.getByText("DT")).toBeInTheDocument();
  });

  it("renders dash for scenario without hcp_profile", () => {
    const noHcpScenario = makeScenario({ hcp_profile: undefined });
    renderTable({ scenarios: [noHcpScenario] });
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders mode badge", () => {
    renderTable();
    expect(screen.getByText("f2f")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    renderTable();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders secondary badge for non-active status", () => {
    const draftScenario = makeScenario({ status: "draft" });
    renderTable({ scenarios: [draftScenario] });
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("renders difficulty with correct style", () => {
    const medScenario = makeScenario({ difficulty: "medium" });
    renderTable({ scenarios: [medScenario] });
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("renders hard difficulty style", () => {
    const hardScenario = makeScenario({ difficulty: "hard" });
    renderTable({ scenarios: [hardScenario] });
    expect(screen.getByText("hard")).toBeInTheDocument();
  });

  it("shows pagination when more than 10 scenarios", () => {
    const manyScenarios = Array.from({ length: 15 }, (_, i) =>
      makeScenario({ id: `sc-${i}`, name: `Scenario ${i}` })
    );
    renderTable({ scenarios: manyScenarios });
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("navigates to next page", async () => {
    const manyScenarios = Array.from({ length: 15 }, (_, i) =>
      makeScenario({ id: `sc-${i}`, name: `Scenario ${i}` })
    );
    renderTable({ scenarios: manyScenarios });
    await userEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("navigates back to previous page", async () => {
    const manyScenarios = Array.from({ length: 15 }, (_, i) =>
      makeScenario({ id: `sc-${i}`, name: `Scenario ${i}` })
    );
    renderTable({ scenarios: manyScenarios });
    await userEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Previous"));
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("does not show pagination for 10 or fewer scenarios", () => {
    renderTable();
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  it("navigates to edit page via dropdown menu", async () => {
    renderTable();
    const menuButton = screen.getByRole("button", { name: "" });
    await userEvent.click(menuButton);
    await userEvent.click(screen.getByText("Edit"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/scenarios/sc-1");
  });

  it("calls onClone via dropdown menu", async () => {
    const onClone = vi.fn();
    renderTable({ onClone });
    const menuButton = screen.getByRole("button", { name: "" });
    await userEvent.click(menuButton);
    await userEvent.click(screen.getByText("Clone"));
    expect(onClone).toHaveBeenCalledWith("sc-1");
  });

  it("calls onDelete via dropdown menu", async () => {
    const onDelete = vi.fn();
    renderTable({ onDelete });
    const menuButton = screen.getByRole("button", { name: "" });
    await userEvent.click(menuButton);
    await userEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("sc-1");
  });
});
