import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { RubricTable } from "./rubric-table";
import type { Rubric } from "@/types/rubric";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const mockRubrics: Rubric[] = [
  {
    id: "r1",
    name: "F2F Default",
    description: "Standard F2F rubric",
    scenario_type: "f2f",
    dimensions: [
      {
        name: "Knowledge",
        weight: 50,
        criteria: ["accuracy"],
        max_score: 100,
      },
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
  {
    id: "r2",
    name: "Conference Custom",
    description: "Custom conference rubric",
    scenario_type: "conference",
    dimensions: [
      {
        name: "Presentation",
        weight: 100,
        criteria: ["structure"],
        max_score: 100,
      },
    ],
    is_default: false,
    created_by: "admin",
    created_at: "2024-02-01",
    updated_at: "2024-02-01",
  },
];

describe("RubricTable", () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("renders empty state when no rubrics", () => {
    render(
      <RubricTable rubrics={[]} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
    );
    expect(screen.getByText("rubrics.emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("rubrics.emptyBody")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(
      <RubricTable
        rubrics={mockRubrics}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );
    expect(screen.getByText("rubrics.name")).toBeInTheDocument();
    expect(screen.getByText("rubrics.scenarioType")).toBeInTheDocument();
    expect(screen.getByText("rubrics.dimensions")).toBeInTheDocument();
    expect(screen.getByText("rubrics.isDefault")).toBeInTheDocument();
    expect(screen.getByText("rubrics.actions")).toBeInTheDocument();
  });

  it("renders rubric names", () => {
    render(
      <RubricTable
        rubrics={mockRubrics}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );
    expect(screen.getByText("F2F Default")).toBeInTheDocument();
    expect(screen.getByText("Conference Custom")).toBeInTheDocument();
  });

  it("renders scenario type via translation key", () => {
    render(
      <RubricTable
        rubrics={mockRubrics}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );
    expect(screen.getByText("rubrics.f2f")).toBeInTheDocument();
    expect(screen.getByText("rubrics.conference")).toBeInTheDocument();
  });

  it("renders dimension count badges", () => {
    render(
      <RubricTable
        rubrics={mockRubrics}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders Default badge for default rubric only", () => {
    render(
      <RubricTable
        rubrics={mockRubrics}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );
    const defaultBadges = screen.getAllByText("rubrics.default");
    expect(defaultBadges).toHaveLength(1);
  });

  it("calls onEdit when edit button is clicked", async () => {
    render(
      <RubricTable
        rubrics={mockRubrics}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );
    const user = userEvent.setup();
    // There should be edit buttons (icon-only buttons)
    const editButtons = screen.getAllByRole("button");
    // First edit button (Pencil icon) for first rubric
    await user.click(editButtons[0]!);
    expect(mockOnEdit).toHaveBeenCalledWith(mockRubrics[0]);
  });

  it("calls onDelete when delete button is clicked", async () => {
    render(
      <RubricTable
        rubrics={mockRubrics}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );
    const user = userEvent.setup();
    const allButtons = screen.getAllByRole("button");
    // Delete buttons are every other button (edit, delete, edit, delete)
    await user.click(allButtons[1]!);
    expect(mockOnDelete).toHaveBeenCalledWith("r1");
  });
});
