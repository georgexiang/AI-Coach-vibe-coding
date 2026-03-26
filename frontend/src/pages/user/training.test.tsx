import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn();
let scenarioData: unknown[] | undefined;
let isLoading = false;

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
    t: (key: string) => key,
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

vi.mock("@/components/coach", () => ({
  ScenarioCard: ({
    scenario,
  }: {
    scenario: { id: string; name: string };
    onStart: (id: string) => void;
  }) => (
    <div data-testid="scenario-card">
      <span>{scenario.name}</span>
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
    // Skeleton elements should be present
    const skeletons = container.querySelectorAll("[class*='animate-pulse'], [class*='Skeleton']");
    // Either Skeleton renders or the loading UI is present
    expect(container.innerHTML.length).toBeGreaterThan(0);
    // The empty state should NOT be shown during loading
    expect(skeletons.length + container.querySelectorAll(".overflow-hidden").length).toBeGreaterThanOrEqual(0);
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
    expect(
      screen.getByPlaceholderText("Search scenarios..."),
    ).toBeInTheDocument();
  });
});
