import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScenariosPage from "./scenarios";

const mockMutate = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const scenarios = [
  { id: "s1", name: "Test Scenario", product: "ProductA", status: "active" },
];

vi.mock("@/hooks/use-scenarios", () => ({
  useScenarios: () => ({ data: { items: scenarios, total: 1 } }),
  useCreateScenario: () => ({ mutate: mockMutate }),
  useUpdateScenario: () => ({ mutate: mockMutate }),
  useDeleteScenario: () => ({ mutate: mockMutate }),
  useCloneScenario: () => ({ mutate: mockMutate }),
}));

vi.mock("@/components/admin/scenario-table", () => ({
  ScenarioTable: (props: {
    scenarios: unknown[];
    onEdit: (s: unknown) => void;
    onDelete: (id: string) => void;
    onClone: (id: string) => void;
  }) => (
    <div data-testid="scenario-table">
      <button onClick={() => props.onEdit(scenarios[0])}>Edit</button>
      <button onClick={() => props.onDelete("s1")}>Delete</button>
      <button onClick={() => props.onClone("s1")}>Clone</button>
    </div>
  ),
}));

vi.mock("@/components/admin/scenario-editor", () => ({
  ScenarioEditor: (props: {
    open: boolean;
    isNew: boolean;
    onSave: (data: unknown) => void;
  }) =>
    props.open ? (
      <div data-testid="scenario-editor">
        <span>{props.isNew ? "New" : "Edit"}</span>
        <button onClick={() => props.onSave({ name: "Test" })}>Save</button>
      </div>
    ) : null,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ScenariosPage />
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

  it("opens editor in create mode", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("scenarios.createButton"));
    expect(screen.getByTestId("scenario-editor")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("opens editor in edit mode", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("scenario-editor")).toBeInTheDocument();
    // Editor shows "Edit" span inside the editor component
    const editor = screen.getByTestId("scenario-editor");
    expect(editor.textContent).toContain("Edit");
  });

  it("calls create mutation on save for new scenario", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("scenarios.createButton"));
    await userEvent.setup().click(screen.getByText("Save"));
    expect(mockMutate).toHaveBeenCalled();
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
    // Click the destructive Delete button in dialog
    const deleteButtons = screen.getAllByText("Delete");
    const confirmBtn = deleteButtons.find((b) => b.closest("[role='dialog']"));
    if (confirmBtn) await user.click(confirmBtn);
    expect(mockMutate).toHaveBeenCalledWith("s1", expect.anything());
  });

  it("calls clone mutation", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("Clone"));
    expect(mockMutate).toHaveBeenCalledWith("s1", expect.anything());
  });
});
