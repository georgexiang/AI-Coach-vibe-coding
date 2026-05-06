import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import ScenariosPage from "./scenarios";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockDeleteMutate = vi.fn();
const mockCloneMutate = vi.fn();
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
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const scenarios = [
  { id: "s1", name: "Test Scenario", tags: ["product:ProductA"], status: "active" },
];

vi.mock("@/hooks/use-scenarios", () => ({
  useScenarios: () => ({ data: { items: scenarios, total: 1 } }),
  useDeleteScenario: () => ({ mutate: mockDeleteMutate }),
  useCloneScenario: () => ({ mutate: mockCloneMutate }),
}));

vi.mock("@/components/admin/scenario-table", () => ({
  ScenarioTable: (props: {
    scenarios: unknown[];
    onDelete: (id: string) => void;
    onClone: (id: string) => void;
  }) => (
    <div data-testid="scenario-table">
      <button onClick={() => props.onDelete("s1")}>Delete</button>
      <button onClick={() => props.onClone("s1")}>Clone</button>
    </div>
  ),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ScenariosPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ScenariosPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders title and create button", () => {
    renderPage();
    expect(screen.getByText("scenarios.title")).toBeInTheDocument();
    expect(screen.getByText("scenarios.createButton")).toBeInTheDocument();
  });

  it("renders scenario table", () => {
    renderPage();
    expect(screen.getByTestId("scenario-table")).toBeInTheDocument();
  });

  it("navigates to /admin/scenarios/new on create click", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("scenarios.createButton"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/scenarios/new");
  });

  it("shows delete confirmation dialog", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("Delete"));
    expect(screen.getByText("Delete Scenario")).toBeInTheDocument();
    expect(screen.getByText("scenarios.deleteConfirm")).toBeInTheDocument();
  });

  it("confirms delete and calls mutation", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Delete"));
    const deleteButtons = screen.getAllByText("Delete");
    const confirmBtn = deleteButtons.find((b) => b.closest("[role='dialog']"));
    if (confirmBtn) await user.click(confirmBtn);
    expect(mockDeleteMutate).toHaveBeenCalledWith("s1", expect.anything());
  });

  it("cancels delete dialog", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Delete"));
    expect(screen.getByText("Delete Scenario")).toBeInTheDocument();
    await user.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Delete Scenario")).not.toBeInTheDocument();
  });

  it("calls clone mutation", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("Clone"));
    expect(mockCloneMutate).toHaveBeenCalledWith("s1", expect.anything());
  });

  it("triggers delete onSuccess callback", async () => {
    mockDeleteMutate.mockImplementation((_id: string, opts: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Delete"));
    const deleteButtons = screen.getAllByText("Delete");
    const confirmBtn = deleteButtons.find((b) => b.closest("[role='dialog']"));
    if (confirmBtn) await user.click(confirmBtn);
    expect(screen.queryByText("Delete Scenario")).not.toBeInTheDocument();
  });
});
