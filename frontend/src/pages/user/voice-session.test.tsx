import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [
    new URLSearchParams("id=session-1&mode=voice"),
  ],
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: (id: string | undefined) => ({
    data: id
      ? {
          id: "session-1",
          scenario_id: "scenario-1",
          status: "in_progress",
          started_at: "2026-03-27T08:00:00Z",
        }
      : undefined,
    isLoading: false,
  }),
  useEndSession: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-scenarios", () => ({
  useScenario: (id: string | undefined) => ({
    data: id
      ? {
          id: "scenario-1",
          name: "Test Scenario",
          description: "Test prompt",
          product: "TestDrug",
          therapeutic_area: "Oncology",
          mode: "f2f",
          difficulty: "medium",
          status: "active",
          hcp_profile_id: "hcp-1",
          hcp_profile: { name: "Dr. Smith", specialty: "Oncology", personality_type: "analytical" },
          key_messages: ["msg1"],
          weight_key_message: 30,
          weight_objection_handling: 25,
          weight_communication: 20,
          weight_product_knowledge: 15,
          weight_scientific_info: 10,
          pass_threshold: 70,
          created_by: "admin",
          created_at: "",
          updated_at: "",
        }
      : undefined,
    isLoading: false,
  }),
}));

vi.mock("@/components/voice/voice-session", () => ({
  VoiceSession: (props: Record<string, unknown>) => (
    <div data-testid="voice-session">
      <span data-testid="session-id">{String(props["sessionId"])}</span>
      <span data-testid="scenario-id">{String(props["scenarioId"])}</span>
      <span data-testid="mode">{String(props["mode"])}</span>
      <span data-testid="hcp-name">{String(props["hcpName"])}</span>
    </div>
  ),
}));

describe("VoiceSessionPage", () => {
  it("renders without crash", async () => {
    const { default: VoiceSessionPage } = await import("./voice-session");
    render(<VoiceSessionPage />);
    expect(screen.getByTestId("voice-session")).toBeInTheDocument();
  });

  it("shows loading state while session is being created", async () => {
    // Override useSession to return loading
    vi.doMock("@/hooks/use-session", () => ({
      useSession: () => ({
        data: undefined,
        isLoading: true,
      }),
      useEndSession: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
      }),
    }));

    // Re-import to get updated mock
    vi.resetModules();

    // Re-mock dependencies that resetModules cleared
    vi.doMock("react-i18next", () => ({
      useTranslation: () => ({
        t: (key: string) => key,
        i18n: { changeLanguage: vi.fn(), language: "en" },
      }),
    }));
    vi.doMock("react-router-dom", () => ({
      useSearchParams: () => [new URLSearchParams("id=session-1&mode=voice")],
      useNavigate: () => vi.fn(),
    }));
    vi.doMock("@/hooks/use-scenarios", () => ({
      useScenario: () => ({ data: undefined, isLoading: true }),
    }));
    vi.doMock("@/components/voice/voice-session", () => ({
      VoiceSession: () => <div data-testid="voice-session" />,
    }));

    const { default: VoiceSessionPage } = await import("./voice-session");
    const { container } = render(<VoiceSessionPage />);
    // When loading, the VoiceSession component should not be rendered
    expect(screen.queryByTestId("voice-session")).not.toBeInTheDocument();
    // Should show loading spinner
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders VoiceSession component with correct props after session load", async () => {
    // Reset modules and re-establish mocks
    vi.resetModules();
    vi.doMock("react-i18next", () => ({
      useTranslation: () => ({
        t: (key: string) => key,
        i18n: { changeLanguage: vi.fn(), language: "en" },
      }),
    }));
    vi.doMock("react-router-dom", () => ({
      useSearchParams: () => [new URLSearchParams("id=session-1")],
      useNavigate: () => vi.fn(),
    }));
    vi.doMock("@/hooks/use-session", () => ({
      useSession: (id: string | undefined) => ({
        data: id
          ? { id: "session-1", scenario_id: "scenario-1", status: "in_progress", started_at: "2026-03-27T08:00:00Z" }
          : undefined,
        isLoading: false,
      }),
      useEndSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
    }));
    vi.doMock("@/hooks/use-scenarios", () => ({
      useScenario: (id: string | undefined) => ({
        data: id
          ? {
              id: "scenario-1",
              name: "Test Scenario",
              hcp_profile: { name: "Dr. Chen", avatar_character: "lisa" },
              description: "Prompt",
              key_messages: [],
              product: "",
              therapeutic_area: "",
              mode: "f2f",
              difficulty: "medium",
              status: "active",
              hcp_profile_id: "hcp-1",
              weight_key_message: 30,
              weight_objection_handling: 25,
              weight_communication: 20,
              weight_product_knowledge: 15,
              weight_scientific_info: 10,
              pass_threshold: 70,
              created_by: "",
              created_at: "",
              updated_at: "",
            }
          : undefined,
        isLoading: false,
      }),
    }));
    vi.doMock("@/components/voice/voice-session", () => ({
      VoiceSession: (props: Record<string, unknown>) => (
        <div data-testid="voice-session">
          <span data-testid="session-id">{String(props["sessionId"])}</span>
          <span data-testid="hcp-name">{String(props["hcpName"])}</span>
          <span data-testid="hcp-profile-id">{String(props["hcpProfileId"])}</span>
        </div>
      ),
    }));

    const { default: VoiceSessionPage } = await import("./voice-session");
    render(<VoiceSessionPage />);

    expect(screen.getByTestId("session-id")).toHaveTextContent("session-1");
    expect(screen.getByTestId("hcp-name")).toHaveTextContent("Dr. Chen");
    expect(screen.getByTestId("hcp-profile-id")).toHaveTextContent("hcp-1");
  });
});
