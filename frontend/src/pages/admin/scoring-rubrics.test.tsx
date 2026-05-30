import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScoringRubricsPage from "./scoring-rubrics";
import type { Rubric } from "@/types/rubric";

const mockNavigate = vi.fn();
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

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/use-rubrics", () => ({
  useRubrics: () => ({ data: mockRubrics }),
  useDeleteRubric: () => ({ mutate: mockDeleteMutate }),
}));

vi.mock("@/components/admin/rubric-table", () => ({
  RubricTable: (props: {
    rubrics: Rubric[];
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
  }) => (
    <div data-testid="rubric-table">
      <span>Rubrics: {props.rubrics.length}</span>
      <button onClick={() => props.onEdit("r1")}>Edit</button>
      <button onClick={() => props.onDelete("r1")}>Delete</button>
    </div>
  ),
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

  it("navigates to create page when create button clicked", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("rubrics.createButton"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/scoring-rubrics/new");
  });

  it("navigates to edit page when edit is triggered", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Edit"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/scoring-rubrics/r1");
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
    expect(screen.queryByText("rubrics.deleteTitle")).not.toBeInTheDocument();
  });

  it("renders scenario type filter", () => {
    renderPage();
    expect(screen.getByText("all")).toBeInTheDocument();
  });
});
