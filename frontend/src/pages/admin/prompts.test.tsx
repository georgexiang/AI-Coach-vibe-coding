import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PromptsPage from "./prompts";
import type { PromptSummary } from "@/types/prompt";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      (opts?.defaultValue as string) ?? key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

let mockPromptsReturn: { data: PromptSummary[] | undefined };
vi.mock("@/hooks/use-prompts", () => ({
  usePrompts: () => mockPromptsReturn,
}));

const makeSummary = (overrides: Partial<PromptSummary> = {}): PromptSummary => ({
  key: "hcp.system",
  name: "HCP System Prompt",
  category: "hcp",
  is_system: true,
  active_version_no: 1,
  updated_at: "2026-06-01T00:00:00Z",
  last_optimized_at: null,
  ...overrides,
});

function renderPage() {
  return render(
    <MemoryRouter>
      <PromptsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPromptsReturn = { data: [makeSummary()] };
});

describe("PromptsPage", () => {
  it("renders a row per prompt", () => {
    mockPromptsReturn = {
      data: [makeSummary(), makeSummary({ key: "scoring.base", name: "Scoring" })],
    };
    renderPage();
    expect(screen.getByTestId("prompt-row-hcp.system")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-row-scoring.base")).toBeInTheDocument();
    expect(screen.getByText("HCP System Prompt")).toBeInTheDocument();
  });

  it("shows an empty message when there are no prompts", () => {
    mockPromptsReturn = { data: [] };
    renderPage();
    expect(screen.getByText("list.empty")).toBeInTheDocument();
  });

  it("navigates to the editor when a row is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("prompt-row-hcp.system"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/prompts/hcp.system");
  });

  it("shows the active version number", () => {
    mockPromptsReturn = { data: [makeSummary({ active_version_no: 3 })] };
    renderPage();
    expect(screen.getByText("v3")).toBeInTheDocument();
  });
});
