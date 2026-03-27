import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScenariosPage from "./scenarios";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockCloneMutate = vi.fn();

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
  useCreateScenario: () => ({ mutate: mockCreateMutate }),
  useUpdateScenario: () => ({ mutate: mockUpdateMutate }),
  useDeleteScenario: () => ({ mutate: mockDeleteMutate }),
  useCloneScenario: () => ({ mutate: mockCloneMutate }),
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
    const editor = screen.getByTestId("scenario-editor");
    expect(editor.textContent).toContain("Edit");
  });

  it("calls create mutation on save for new scenario", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("scenarios.createButton"));
    await userEvent.setup().click(screen.getByText("Save"));
    expect(mockCreateMutate).toHaveBeenCalled();
  });

  it("calls update mutation on save for existing scenario", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByText("Save"));
    expect(mockUpdateMutate).toHaveBeenCalled();
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

  it("triggers create onSuccess callback (closes editor)", async () => {
    mockCreateMutate.mockImplementation((_data: unknown, opts: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("scenarios.createButton"));
    expect(screen.getByTestId("scenario-editor")).toBeInTheDocument();
    await user.click(screen.getByText("Save"));
    // After onSuccess, editor should close
    expect(screen.queryByTestId("scenario-editor")).not.toBeInTheDocument();
  });

  it("triggers create onError callback", async () => {
    mockCreateMutate.mockImplementation((_data: unknown, opts: { onError?: () => void }) => {
      opts?.onError?.();
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("scenarios.createButton"));
    await user.click(screen.getByText("Save"));
    expect(mockCreateMutate).toHaveBeenCalled();
  });

  it("triggers update onSuccess callback (closes editor)", async () => {
    mockUpdateMutate.mockImplementation((_data: unknown, opts: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByText("Save"));
    expect(screen.queryByTestId("scenario-editor")).not.toBeInTheDocument();
  });

  it("triggers update onError callback", async () => {
    mockUpdateMutate.mockImplementation((_data: unknown, opts: { onError?: () => void }) => {
      opts?.onError?.();
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByText("Save"));
    expect(mockUpdateMutate).toHaveBeenCalled();
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
    // Dialog should be closed after success
    expect(screen.queryByText("Delete Scenario")).not.toBeInTheDocument();
  });
});
