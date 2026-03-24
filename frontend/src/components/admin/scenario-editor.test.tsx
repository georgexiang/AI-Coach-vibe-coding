import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioEditor } from "./scenario-editor";
import type { Scenario } from "@/types/scenario";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/hooks/use-hcp-profiles", () => ({
  useHcpProfiles: () => ({
    data: {
      items: [
        {
          id: "hcp-1",
          name: "Dr. Test",
          specialty: "Oncology",
          avatar_url: "",
          personality_type: "friendly",
          emotional_state: 30,
          communication_style: 50,
        },
      ],
    },
  }),
}));

const mockScenario: Scenario = {
  id: "sc-1",
  name: "Test Scenario",
  description: "A test scenario",
  product: "Tislelizumab",
  therapeutic_area: "Oncology",
  mode: "f2f",
  difficulty: "medium",
  status: "active",
  hcp_profile_id: "hcp-1",
  key_messages: ["Key message 1"],
  weight_key_message: 30,
  weight_objection_handling: 25,
  weight_communication: 20,
  weight_product_knowledge: 15,
  weight_scientific_info: 10,
  pass_threshold: 70,
  created_by: "admin-1",
  created_at: "2024-01-01",
  updated_at: "2024-01-02",
};

describe("ScenarioEditor", () => {
  const defaultProps = {
    scenario: null as Scenario | null,
    open: true,
    onOpenChange: vi.fn(),
    onSave: vi.fn(),
    isNew: true,
  };

  it("renders create dialog title when isNew", async () => {
    render(<ScenarioEditor {...defaultProps} />);

    // Radix Dialog uses role="dialog"
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("scenarios.createButton"),
    ).toBeInTheDocument();
  });

  it("renders edit dialog with scenario name when editing", async () => {
    render(
      <ScenarioEditor
        {...defaultProps}
        scenario={mockScenario}
        isNew={false}
      />,
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Edit: Test Scenario"),
    ).toBeInTheDocument();
  });

  it("renders description text inside dialog", async () => {
    render(<ScenarioEditor {...defaultProps} />);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        "Configure scenario details and scoring weights",
      ),
    ).toBeInTheDocument();
  });

  it("does not call onSave when required name field is empty", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<ScenarioEditor {...defaultProps} onSave={onSave} />);

    const dialog = await screen.findByRole("dialog");

    // Click save without filling required fields
    const saveBtn = within(dialog).getByText("scenarios.save");
    await user.click(saveBtn);

    // Wait a moment for any async validation to complete
    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it("does not render dialog when open is false", () => {
    render(<ScenarioEditor {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders mode radio buttons inside dialog", async () => {
    render(<ScenarioEditor {...defaultProps} />);

    const dialog = await screen.findByRole("dialog");
    // The radio buttons display uppercase mode labels: "f2f" and "conference"
    const radios = within(dialog).getAllByRole("radio");
    expect(radios.length).toBeGreaterThanOrEqual(2);
  });
});
