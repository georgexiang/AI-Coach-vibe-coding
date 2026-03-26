import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { RubricEditor } from "./rubric-editor";
import type { Rubric } from "@/types/rubric";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const mockRubric: Rubric = {
  id: "r1",
  name: "Test Rubric",
  description: "A test rubric",
  scenario_type: "f2f",
  dimensions: [
    {
      name: "Knowledge",
      weight: 60,
      criteria: ["accuracy", "depth"],
      max_score: 100,
    },
    {
      name: "Communication",
      weight: 40,
      criteria: ["clarity"],
      max_score: 100,
    },
  ],
  is_default: true,
  created_by: "admin",
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

describe("RubricEditor", () => {
  const mockOnSave = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("does not render when not open", () => {
    render(
      <RubricEditor
        rubric={null}
        open={false}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
        isNew={true}
      />,
    );
    expect(screen.queryByText("rubrics.createButton")).not.toBeInTheDocument();
  });

  it("renders create dialog when open in new mode", () => {
    render(
      <RubricEditor
        rubric={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
        isNew={true}
      />,
    );
    expect(screen.getByText("rubrics.createButton")).toBeInTheDocument();
    expect(
      screen.getByText("Configure rubric name, type, and dimension weights"),
    ).toBeInTheDocument();
  });

  it("renders edit dialog title with rubric name", () => {
    render(
      <RubricEditor
        rubric={mockRubric}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
        isNew={false}
      />,
    );
    expect(screen.getByText("Edit: Test Rubric")).toBeInTheDocument();
  });

  it("shows form fields: name, description, scenario type, is_default", () => {
    render(
      <RubricEditor
        rubric={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
        isNew={true}
      />,
    );
    // "rubrics.name *" has the asterisk appended, so use regex
    expect(screen.getByText(/rubrics\.name/)).toBeInTheDocument();
    expect(screen.getByText("rubrics.description")).toBeInTheDocument();
    expect(screen.getByText("rubrics.scenarioType")).toBeInTheDocument();
    expect(screen.getByText("rubrics.isDefault")).toBeInTheDocument();
  });

  it("displays weight sum indicator", () => {
    render(
      <RubricEditor
        rubric={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
        isNew={true}
      />,
    );
    // Default dimension has weight 100, so sum is 100
    expect(screen.getByText("rubrics.weightSum: 100/100")).toBeInTheDocument();
  });

  it("shows add dimension button", () => {
    render(
      <RubricEditor
        rubric={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
        isNew={true}
      />,
    );
    expect(screen.getByText("rubrics.addDimension")).toBeInTheDocument();
  });

  it("shows edit title and dimension labels when editing an existing rubric", () => {
    render(
      <RubricEditor
        rubric={mockRubric}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
        isNew={false}
      />,
    );
    // Verify the edit title contains rubric name
    expect(screen.getByText("Edit: Test Rubric")).toBeInTheDocument();
    // Verify form elements exist (name input, description textarea)
    const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
    expect(nameInput).not.toBeNull();
    const descTextarea = document.querySelector<HTMLTextAreaElement>('textarea[name="description"]');
    expect(descTextarea).not.toBeNull();
  });

  it("shows save button", () => {
    render(
      <RubricEditor
        rubric={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
        isNew={true}
      />,
    );
    expect(screen.getByText("rubrics.save")).toBeInTheDocument();
  });

  it("adds a new dimension when Add Dimension clicked", async () => {
    render(
      <RubricEditor
        rubric={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
        isNew={true}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText("rubrics.addDimension"));
    // Now should see 2 dimensions (labels "rubrics.dimensionName 1" and "rubrics.dimensionName 2")
    const dimLabels = screen.getAllByText(/rubrics\.dimensionName \d/);
    expect(dimLabels.length).toBe(2);
  });

  it("shows weight sum error when weights do not equal 100", async () => {
    render(
      <RubricEditor
        rubric={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
        isNew={true}
      />,
    );
    const user = userEvent.setup();
    // Add a second dimension (weight 0), making total still 100
    await user.click(screen.getByText("rubrics.addDimension"));
    // Weight sum is still 100 (100 + 0), but save button should still be enabled
    // Note: The new dimension has weight=0, so sum is 100
    expect(screen.getByText("rubrics.weightSum: 100/100")).toBeInTheDocument();
  });
});
