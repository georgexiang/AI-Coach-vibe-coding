import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioCard } from "./scenario-card";
import type { Scenario } from "@/types/scenario";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const mockScenario: Scenario = {
  id: "sc-1",
  name: "Oncology Visit",
  description: "Practice F2F with oncologist",
  product: "DrugX",
  therapeutic_area: "Oncology",
  mode: "f2f",
  difficulty: "medium",
  status: "active",
  hcp_profile_id: "hcp-1",
  hcp_profile: {
    id: "hcp-1",
    name: "Dr. Jane Doe",
    specialty: "Oncology",
    hospital: "General Hospital",
    title: "Senior Physician",
    avatar_url: "",
    personality_type: "analytical",
    emotional_state: 50,
    communication_style: 70,
    expertise_areas: [],
    prescribing_habits: "",
    concerns: "",
    objections: [],
    probe_topics: [],
    difficulty: "medium",
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
  key_messages: ["Efficacy", "Safety"],
  weight_key_message: 30,
  weight_objection_handling: 20,
  weight_communication: 20,
  weight_product_knowledge: 15,
  weight_scientific_info: 15,
  pass_threshold: 70,
  estimated_duration: 20,
  created_by: "admin",
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  skill_id: null,
  skill_version_id: null,
};

describe("ScenarioCard", () => {
  it("renders HCP name and description", () => {
    render(<ScenarioCard scenario={mockScenario} onStart={vi.fn()} />);
    // Component shows hcp_profile.name as the main heading
    expect(screen.getByText("Dr. Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Practice F2F with oncologist")).toBeInTheDocument();
  });

  it("renders HCP name and specialty", () => {
    render(<ScenarioCard scenario={mockScenario} onStart={vi.fn()} />);
    expect(screen.getByText("Dr. Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Oncology")).toBeInTheDocument();
  });

  it("renders difficulty badge", () => {
    render(<ScenarioCard scenario={mockScenario} onStart={vi.fn()} />);
    const badges = screen.getAllByText("medium");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("calls onStart with scenario id when start button is clicked", async () => {
    const onStart = vi.fn();
    render(<ScenarioCard scenario={mockScenario} onStart={onStart} />);
    await userEvent.click(screen.getByText("scenarioSelection.startButton"));
    expect(onStart).toHaveBeenCalledWith("sc-1");
  });

  it("renders product badge", () => {
    render(<ScenarioCard scenario={mockScenario} onStart={vi.fn()} />);
    expect(screen.getByText("DrugX")).toBeInTheDocument();
  });
});
