import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CuStatusSection } from "./cu-status-section";

import type { CuPortalUrlResponse } from "@/api/rubrics";

const mockCuPortalData: CuPortalUrlResponse = {
  cu_content_analyzer_id: "rubric-r1-content",
  cu_voice_analyzer_id: "rubric-r1-voice",
  content_analyzer_url: "https://cu.azure.com/contentunderstanding/analyzers/rubric-r1-content",
  voice_analyzer_url: "https://cu.azure.com/contentunderstanding/analyzers/rubric-r1-voice",
  cu_endpoint: "https://cu.azure.com",
};

let mockReturnData: CuPortalUrlResponse | null = mockCuPortalData;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        "admin:rubrics.cuAnalyzers": "Content Understanding Analyzers",
        "admin:rubrics.cuNoAnalyzers": "CU analyzers will be auto-created when Azure Content Understanding is configured.",
        "admin:rubrics.cuContentAnalyzer": "Content Analyzer",
        "admin:rubrics.cuVoiceAnalyzer": "Voice Analyzer",
        "admin:rubrics.cuViewInPortal": "View in Azure Portal",
        "admin:rubrics.cuEndpoint": "CU Endpoint",
      };
      return keys[key] ?? key;
    },
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("@/hooks/use-rubrics", () => ({
  useCuPortalUrl: () => ({
    data: mockReturnData,
    isLoading: false,
  }),
}));

function renderComponent(rubricId: string | undefined) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CuStatusSection rubricId={rubricId} />
    </QueryClientProvider>,
  );
}

describe("CuStatusSection", () => {
  it("renders nothing when rubricId is undefined", () => {
    const { container } = renderComponent(undefined);
    expect(container.firstChild).toBeNull();
  });

  it("renders CU analyzers card with both analyzers", () => {
    renderComponent("r1");
    expect(screen.getByText("Content Understanding Analyzers")).toBeInTheDocument();
    expect(screen.getByText("Content Analyzer")).toBeInTheDocument();
    expect(screen.getByText("Voice Analyzer")).toBeInTheDocument();
  });

  it("displays content analyzer ID", () => {
    renderComponent("r1");
    expect(screen.getByText("rubric-r1-content")).toBeInTheDocument();
  });

  it("displays voice analyzer ID", () => {
    renderComponent("r1");
    expect(screen.getByText("rubric-r1-voice")).toBeInTheDocument();
  });

  it("shows CU endpoint", () => {
    renderComponent("r1");
    expect(screen.getByText("https://cu.azure.com")).toBeInTheDocument();
  });

  it("renders View in Azure Portal buttons", () => {
    renderComponent("r1");
    const portalButtons = screen.getAllByText("View in Azure Portal");
    expect(portalButtons).toHaveLength(2);
  });

  it("opens content analyzer URL on click", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    renderComponent("r1");
    const user = userEvent.setup();
    const portalButtons = screen.getAllByText("View in Azure Portal");
    await user.click(portalButtons[0]!);
    expect(windowOpen).toHaveBeenCalledWith(
      "https://cu.azure.com/contentunderstanding/analyzers/rubric-r1-content",
      "_blank",
      "noopener,noreferrer",
    );
    windowOpen.mockRestore();
  });

  it("opens voice analyzer URL on click", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    renderComponent("r1");
    const user = userEvent.setup();
    const portalButtons = screen.getAllByText("View in Azure Portal");
    await user.click(portalButtons[1]!);
    expect(windowOpen).toHaveBeenCalledWith(
      "https://cu.azure.com/contentunderstanding/analyzers/rubric-r1-voice",
      "_blank",
      "noopener,noreferrer",
    );
    windowOpen.mockRestore();
  });

  it("shows empty state when no analyzers configured", () => {
    mockReturnData = {
      cu_content_analyzer_id: null,
      cu_voice_analyzer_id: null,
      content_analyzer_url: null,
      voice_analyzer_url: null,
      cu_endpoint: null,
    };
    renderComponent("r1");
    expect(
      screen.getByText("CU analyzers will be auto-created when Azure Content Understanding is configured."),
    ).toBeInTheDocument();
    mockReturnData = mockCuPortalData;
  });

  it("shows only content analyzer when voice is null", () => {
    mockReturnData = {
      ...mockCuPortalData,
      cu_voice_analyzer_id: null,
      voice_analyzer_url: null,
    };
    renderComponent("r1");
    expect(screen.getByText("Content Analyzer")).toBeInTheDocument();
    expect(screen.queryByText("Voice Analyzer")).not.toBeInTheDocument();
    mockReturnData = mockCuPortalData;
  });
});
