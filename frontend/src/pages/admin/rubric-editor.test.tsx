import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RubricEditorPage from "./rubric-editor";
import type { Rubric } from "@/types/rubric";

const mockNavigate = vi.fn();
const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();

let mockParamsId: string | undefined = undefined;

const mockRubric: Rubric = {
  id: "r1",
  name: "F2F Default",
  description: "Standard rubric",
  scenario_type: "f2f",
  dimensions: [
    { name: "Knowledge", weight: 60, criteria: ["accuracy", "depth"], max_score: 100 },
    { name: "Communication", weight: 40, criteria: ["clarity"], max_score: 100 },
  ],
  is_default: true,
  created_by: "admin",
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  content_weight: 70,
  voice_weight: 30,
};
let mockRubricResponse: Rubric = mockRubric;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.name) return `${key}: ${params.name}`;
      return key;
    },
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: mockParamsId }),
  useNavigate: () => mockNavigate,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/use-rubrics", () => ({
  useRubric: (id: string | undefined) => ({
    data: id ? mockRubricResponse : undefined,
    isLoading: false,
  }),
  useCreateRubric: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  useUpdateRubric: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
  useCuPortalUrl: () => ({
    data: {
      cu_content_analyzer_id: "rubric-r1-content",
      cu_voice_analyzer_id: "rubric-r1-voice",
      content_analyzer_url: "https://cu.azure.com/contentunderstanding/analyzers/rubric-r1-content",
      voice_analyzer_url: "https://cu.azure.com/contentunderstanding/analyzers/rubric-r1-voice",
      cu_endpoint: "https://cu.azure.com",
    },
    isLoading: false,
  }),
}));

function renderEditor() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <RubricEditorPage />
    </QueryClientProvider>,
  );
}

describe("RubricEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParamsId = undefined;
    mockRubricResponse = mockRubric;
  });

  describe("create mode (new)", () => {
    it("renders create header", () => {
      renderEditor();
      expect(screen.getByText("admin:rubrics.createButton")).toBeInTheDocument();
    });

    it("renders basic info card", () => {
      renderEditor();
      expect(screen.getByText("admin:rubrics.basicInfo")).toBeInTheDocument();
    });

    it("renders dimensions card", () => {
      renderEditor();
      expect(screen.getByText("admin:rubrics.dimensions")).toBeInTheDocument();
    });

    it("renders category weights card", () => {
      renderEditor();
      expect(screen.getByText("admin:rubrics.categoryWeights")).toBeInTheDocument();
    });

    it("renders back button that navigates to list page", async () => {
      renderEditor();
      const user = userEvent.setup();
      const backBtn = screen.getAllByRole("button")[0]!;
      await user.click(backBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/admin/scoring-rubrics");
    });

    it("renders save button", () => {
      renderEditor();
      expect(screen.getByText("admin:rubrics.save")).toBeInTheDocument();
    });

    it("shows weight sum indicator", () => {
      renderEditor();
      expect(screen.getByText(/100\/100/)).toBeInTheDocument();
    });
  });

  describe("edit mode (existing rubric)", () => {
    beforeEach(() => {
      mockParamsId = "r1";
    });

    it("renders edit header with rubric name", () => {
      renderEditor();
      expect(screen.getByText("admin:rubrics.editTitle: F2F Default")).toBeInTheDocument();
    });

    it("populates form with rubric data", async () => {
      renderEditor();
      await waitFor(() => {
        const nameInput = screen.getByDisplayValue("F2F Default");
        expect(nameInput).toBeInTheDocument();
      });
    });

    it("shows description field populated", async () => {
      renderEditor();
      await waitFor(() => {
        expect(screen.getByDisplayValue("Standard rubric")).toBeInTheDocument();
      });
    });

    it("renders dimension fields with data", async () => {
      renderEditor();
      await waitFor(() => {
        expect(screen.getByDisplayValue("Knowledge")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Communication")).toBeInTheDocument();
      });
    });

    it("renders criteria as comma-separated string", async () => {
      renderEditor();
      await waitFor(() => {
        expect(screen.getByDisplayValue("accuracy, depth")).toBeInTheDocument();
      });
    });

    it("falls back to a default dimension when the loaded rubric has no dimensions", async () => {
      mockRubricResponse = {
        ...mockRubric,
        dimensions: undefined,
      } as unknown as Rubric;

      renderEditor();

      await waitFor(() => {
        expect(screen.getByDisplayValue("F2F Default")).toBeInTheDocument();
        expect(screen.getByText(/100\/100/)).toBeInTheDocument();
        expect(screen.getByText("admin:rubrics.dimensionName 1")).toBeInTheDocument();
      });
    });
  });

  describe("CU status section", () => {
    it("does not render CU section in create mode", () => {
      renderEditor();
      expect(screen.queryByText("admin:rubrics.cuAnalyzers")).not.toBeInTheDocument();
    });

    it("renders CU section in edit mode", () => {
      mockParamsId = "r1";
      renderEditor();
      expect(screen.getByText("admin:rubrics.cuAnalyzers")).toBeInTheDocument();
    });

    it("shows content analyzer ID in edit mode", () => {
      mockParamsId = "r1";
      renderEditor();
      expect(screen.getByText("rubric-r1-content")).toBeInTheDocument();
    });

    it("shows voice analyzer ID in edit mode", () => {
      mockParamsId = "r1";
      renderEditor();
      expect(screen.getByText("rubric-r1-voice")).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("navigates back to list on back button click", async () => {
      renderEditor();
      const user = userEvent.setup();
      const backBtn = screen.getAllByRole("button")[0]!;
      await user.click(backBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/admin/scoring-rubrics");
    });
  });
});
