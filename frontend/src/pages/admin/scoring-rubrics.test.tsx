import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScoringRubricsPage from "./scoring-rubrics";
import type { Rubric } from "@/types/rubric";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

const mockRubrics: Rubric[] = [
  {
    id: "r1",
    name: "Default F2F Rubric",
    description: "Standard rubric",
    scenario_type: "f2f",
    dimensions: [
      { name: "Knowledge", weight: 50, criteria: ["accuracy"], max_score: 100 },
      {
        name: "Communication",
        weight: 50,
        criteria: ["clarity"],
        max_score: 100,
      },
    ],
    is_default: true,
    created_by: "admin",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/use-rubrics", () => ({
  useRubrics: () => ({ data: mockRubrics }),
  useCreateRubric: () => ({ mutate: mockCreateMutate }),
  useUpdateRubric: () => ({ mutate: mockUpdateMutate }),
  useDeleteRubric: () => ({ mutate: mockDeleteMutate }),
}));

vi.mock("@/components/admin/rubric-table", () => ({
  RubricTable: (props: {
    rubrics: Rubric[];
    onEdit: (rubric: Rubric) => void;
    onDelete: (id: string) => void;
  }) => (
    <div data-testid="rubric-table">
      <span>Rubrics: {props.rubrics.length}</span>
      <button onClick={() => props.onEdit(mockRubrics[0]!)}>Edit</button>
      <button onClick={() => props.onDelete("r1")}>Delete</button>
    </div>
  ),
}));

vi.mock("@/components/admin/rubric-editor", () => ({
  RubricEditor: (props: {
    rubric: Rubric | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: unknown) => void;
    isNew: boolean;
  }) =>
    props.open ? (
      <div data-testid="rubric-editor">
        <span>{props.isNew ? "NewRubric" : "EditRubric"}</span>
        <button onClick={() => props.onSave({ name: "Test Rubric" })}>
          Save
        </button>
      </div>
    ) : null,
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ScoringRubricsPage />
    </QueryClientProvider>,
  );
}

describe("ScoringRubricsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the page title", () => {
    renderPage();
    expect(screen.getByText("rubrics.title")).toBeInTheDocument();
  });

  it("renders create button", () => {
    renderPage();
    expect(screen.getByText("rubrics.createButton")).toBeInTheDocument();
  });

  it("renders the rubric table with rubric count", () => {
    renderPage();
    expect(screen.getByTestId("rubric-table")).toBeInTheDocument();
    expect(screen.getByText("Rubrics: 1")).toBeInTheDocument();
  });

  it("opens editor in create mode when create button clicked", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("rubrics.createButton"));
    expect(screen.getByTestId("rubric-editor")).toBeInTheDocument();
    expect(screen.getByText("NewRubric")).toBeInTheDocument();
  });

  it("opens editor in edit mode when edit is triggered", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Edit"));
    expect(screen.getByTestId("rubric-editor")).toBeInTheDocument();
    expect(screen.getByText("EditRubric")).toBeInTheDocument();
  });

  it("calls create mutation on save in new mode", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("rubrics.createButton"));
    await user.click(screen.getByText("Save"));
    expect(mockCreateMutate).toHaveBeenCalledWith(
      { name: "Test Rubric" },
      expect.anything(),
    );
  });

  it("calls update mutation on save in edit mode", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Edit"));
    await user.click(screen.getByText("Save"));
    expect(mockUpdateMutate).toHaveBeenCalledWith(
      { id: "r1", data: { name: "Test Rubric" } },
      expect.anything(),
    );
  });

  it("shows delete confirmation dialog when delete is triggered", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Delete"));
    expect(screen.getByText("rubrics.deleteTitle")).toBeInTheDocument();
    expect(screen.getByText("rubrics.deleteConfirm")).toBeInTheDocument();
  });

  it("confirms delete and calls mutation", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Delete"));
    // Click the destructive delete button in dialog (tc("delete") returns "delete")
    const deleteButtons = screen.getAllByText("delete");
    const confirmBtn = deleteButtons.find((b) =>
      b.closest("[role='dialog']"),
    );
    if (confirmBtn) await user.click(confirmBtn);
    expect(mockDeleteMutate).toHaveBeenCalledWith("r1", expect.anything());
  });

  it("cancels delete when Cancel button is clicked", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Delete"));
    expect(screen.getByText("rubrics.deleteTitle")).toBeInTheDocument();
    await user.click(screen.getByText("cancel"));
    // Dialog should be closed — no delete title
    expect(screen.queryByText("rubrics.deleteTitle")).not.toBeInTheDocument();
  });

  it("renders scenario type filter", () => {
    renderPage();
    expect(screen.getByText("all")).toBeInTheDocument();
  });
});
