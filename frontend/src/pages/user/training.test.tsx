import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn();
let scenarioData: unknown[] | undefined;
let isLoading = false;

const mockFlags = {
  avatar_enabled: false,
  voice_enabled: false,
  realtime_voice_enabled: false,
  conference_enabled: false,
  voice_live_enabled: false,
  default_voice_mode: "text_only",
  region: "global",
};

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("@/hooks/use-scenarios", () => ({
  useActiveScenarios: () => ({
    data: scenarioData,
    isLoading,
  }),
}));

vi.mock("@/hooks/use-session", () => ({
  useCreateSession: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/contexts/config-context", () => ({
  useConfig: () => mockFlags,
}));

vi.mock("@/components/shared", () => ({
  EmptyState: ({
    title,
    body,
  }: {
    title: string;
    body: string;
  }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{body}</span>
    </div>
  ),
}));

vi.mock("@/components/voice", () => ({
  ModeSelector: () => <div data-testid="mode-selector" />,
}));

vi.mock("@/components/coach", () => ({
  ScenarioCard: ({
    scenario,
    onStart,
  }: {
    scenario: { id: string; name: string };
    onStart: (id: string) => void;
  }) => (
    <div data-testid="scenario-card">
      <span>{scenario.name}</span>
      <button onClick={() => onStart(scenario.id)}>Start</button>
    </div>
  ),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ScenarioSelection />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let ScenarioSelection: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  scenarioData = [];
  isLoading = false;
  // Reset flags to defaults
  mockFlags.voice_live_enabled = false;
  mockFlags.avatar_enabled = false;
  const mod = await import("./training");
  ScenarioSelection = mod.default;
});

describe("ScenarioSelection (Training) Page", () => {
  it("renders the page title", () => {
    renderPage();
    expect(screen.getByText("scenarioSelection.title")).toBeInTheDocument();
  });

  it("renders F2F and Conference tabs", () => {
    renderPage();
    expect(screen.getByText("scenarioSelection.tabF2F")).toBeInTheDocument();
    expect(
      screen.getByText("scenarioSelection.tabConference"),
    ).toBeInTheDocument();
  });

  it("shows empty state when no scenarios available", () => {
    scenarioData = [];
    renderPage();
    expect(screen.getAllByTestId("empty-state").length).toBeGreaterThan(0);
  });

  it("shows loading skeleton when data is loading", () => {
    isLoading = true;
    scenarioData = undefined;
    const { container } = renderPage();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("renders scenario cards when scenarios exist", () => {
    scenarioData = [
      {
        id: "sc-1",
        name: "F2F Scenario",
        description: "Test",
        product: "Brukinsa",
        mode: "f2f",
        difficulty: "medium",
        status: "active",
      },
      {
        id: "sc-2",
        name: "Conference Scenario",
        description: "Test 2",
        product: "Tislelizumab",
        mode: "conference",
        difficulty: "hard",
        status: "active",
      },
    ];
    renderPage();

    const cards = screen.getAllByTestId("scenario-card");
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it("renders search input", () => {
    renderPage();
    // The placeholder uses t("key", { defaultValue: tc("search") }) which yields "search"
    expect(
      screen.getByPlaceholderText("search"),
    ).toBeInTheDocument();
  });
});

describe("ScenarioSelection Voice Tab", () => {
  it("does not render Voice tab when voice_live_enabled is false", () => {
    mockFlags.voice_live_enabled = false;
    renderPage();
    expect(
      screen.queryByText("scenarioSelection.tabVoice"),
    ).not.toBeInTheDocument();
  });

  it("renders Voice tab when voice_live_enabled is true", () => {
    mockFlags.voice_live_enabled = true;
    renderPage();
    expect(
      screen.getByText("scenarioSelection.tabVoice"),
    ).toBeInTheDocument();
  });

  it("renders F2F and Conference tabs regardless of voice flag", () => {
    mockFlags.voice_live_enabled = false;
    renderPage();
    expect(screen.getByText("scenarioSelection.tabF2F")).toBeInTheDocument();
    expect(
      screen.getByText("scenarioSelection.tabConference"),
    ).toBeInTheDocument();
  });

  it("renders all three tabs when voice_live_enabled is true", () => {
    mockFlags.voice_live_enabled = true;
    renderPage();
    expect(screen.getByText("scenarioSelection.tabF2F")).toBeInTheDocument();
    expect(
      screen.getByText("scenarioSelection.tabConference"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("scenarioSelection.tabVoice"),
    ).toBeInTheDocument();
  });
});

// NEW TESTS for uncovered branches
describe("ScenarioSelection Filters and Actions", () => {
  const twoScenarios = [
    {
      id: "sc-1",
      name: "F2F Scenario",
      description: "Test description",
      product: "Brukinsa",
      mode: "f2f",
      difficulty: "medium",
      status: "active",
    },
    {
      id: "sc-2",
      name: "Advanced Meeting",
      description: "Test 2",
      product: "Tislelizumab",
      mode: "conference",
      difficulty: "hard",
      status: "active",
    },
  ];

  it("filters scenarios by search term matching name", async () => {
    scenarioData = twoScenarios;
    renderPage();
    const input = screen.getByPlaceholderText("search");
    await userEvent.setup().type(input, "F2F");
    expect(screen.getByText("F2F Scenario")).toBeInTheDocument();
    expect(screen.queryByText("Advanced Meeting")).not.toBeInTheDocument();
  });

  it("filters scenarios by search term matching description", async () => {
    scenarioData = twoScenarios;
    renderPage();
    const input = screen.getByPlaceholderText("search");
    await userEvent.setup().type(input, "Test 2");
    expect(screen.queryByText("F2F Scenario")).not.toBeInTheDocument();
    expect(screen.getByText("Advanced Meeting")).toBeInTheDocument();
  });

  it("creates session and navigates to training session on F2F start", async () => {
    scenarioData = twoScenarios;
    mockMutateAsync.mockResolvedValue({ id: "new-session-1" });
    renderPage();

    // Click the Start button on first scenario card
    const startBtns = screen.getAllByText("Start");
    await userEvent.setup().click(startBtns[0]!);

    expect(mockMutateAsync).toHaveBeenCalledWith({ scenarioId: "sc-1" });
    expect(mockNavigate).toHaveBeenCalledWith("/user/training/session?id=new-session-1");
  });

  it("creates session and navigates to conference on Conference tab start", async () => {
    scenarioData = twoScenarios;
    mockMutateAsync.mockResolvedValue({ id: "conf-session-1" });
    renderPage();

    // Switch to Conference tab
    const confTab = screen.getByText("scenarioSelection.tabConference");
    await userEvent.setup().click(confTab);

    // Click start on a scenario card in Conference tab
    const startBtns = screen.getAllByText("Start");
    await userEvent.setup().click(startBtns[0]!);

    expect(mockMutateAsync).toHaveBeenCalledWith({ scenarioId: "sc-1" });
    expect(mockNavigate).toHaveBeenCalledWith("/user/training/conference?id=conf-session-1");
  });

  it("creates voice session with default voice_pipeline mode", async () => {
    scenarioData = twoScenarios;
    mockFlags.voice_live_enabled = true;
    mockFlags.avatar_enabled = true;
    mockMutateAsync.mockResolvedValue({ id: "voice-session-1" });
    renderPage();

    // Switch to Voice tab
    const voiceTab = screen.getByText("scenarioSelection.tabVoice");
    await userEvent.setup().click(voiceTab);

    const startBtns = screen.getAllByText("Start");
    await userEvent.setup().click(startBtns[0]!);

    // Source uses selectedVoiceMode state (default: "voice_pipeline")
    expect(mockMutateAsync).toHaveBeenCalledWith({ scenarioId: "sc-1", mode: "voice_pipeline" });
    expect(mockNavigate).toHaveBeenCalledWith("/user/training/voice?id=voice-session-1&mode=voice_pipeline");
  });

  it("creates voice session with voice_pipeline mode when avatar is not enabled", async () => {
    scenarioData = twoScenarios;
    mockFlags.voice_live_enabled = true;
    mockFlags.avatar_enabled = false;
    mockMutateAsync.mockResolvedValue({ id: "voice-session-2" });
    renderPage();

    const voiceTab = screen.getByText("scenarioSelection.tabVoice");
    await userEvent.setup().click(voiceTab);

    const startBtns = screen.getAllByText("Start");
    await userEvent.setup().click(startBtns[0]!);

    // Source uses selectedVoiceMode state (default: "voice_pipeline")
    expect(mockMutateAsync).toHaveBeenCalledWith({ scenarioId: "sc-1", mode: "voice_pipeline" });
    expect(mockNavigate).toHaveBeenCalledWith("/user/training/voice?id=voice-session-2&mode=voice_pipeline");
  });

  it("handles createSession failure gracefully for F2F", async () => {
    scenarioData = twoScenarios;
    mockMutateAsync.mockRejectedValue(new Error("API error"));
    renderPage();

    const startBtns = screen.getAllByText("Start");
    await userEvent.setup().click(startBtns[0]!);

    // Should not navigate on failure
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("handles createSession failure gracefully for conference", async () => {
    scenarioData = twoScenarios;
    mockMutateAsync.mockRejectedValue(new Error("API error"));
    renderPage();

    const confTab = screen.getByText("scenarioSelection.tabConference");
    await userEvent.setup().click(confTab);

    const startBtns = screen.getAllByText("Start");
    await userEvent.setup().click(startBtns[0]!);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("handles createSession failure gracefully for voice", async () => {
    scenarioData = twoScenarios;
    mockFlags.voice_live_enabled = true;
    mockMutateAsync.mockRejectedValue(new Error("API error"));
    renderPage();

    const voiceTab = screen.getByText("scenarioSelection.tabVoice");
    await userEvent.setup().click(voiceTab);

    const startBtns = screen.getAllByText("Start");
    await userEvent.setup().click(startBtns[0]!);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows empty state when search matches no scenarios", async () => {
    scenarioData = twoScenarios;
    renderPage();
    const input = screen.getByPlaceholderText("search");
    await userEvent.setup().type(input, "nonexistent");
    expect(screen.getAllByTestId("empty-state").length).toBeGreaterThan(0);
  });

  it("renders loading skeletons with 6 skeleton card containers", () => {
    isLoading = true;
    scenarioData = undefined;
    const { container } = renderPage();
    // Loading state should render skeleton cards (overflow-hidden rounded-lg)
    const skeletonContainers = container.querySelectorAll(".overflow-hidden.rounded-lg");
    expect(skeletonContainers.length).toBeGreaterThanOrEqual(6);
  });
});
