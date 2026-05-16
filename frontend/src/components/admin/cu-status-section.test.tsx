import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CuStatusSection } from "./cu-status-section";

import type { CuPortalUrlResponse } from "@/api/rubrics";

const mockCuPortalData: CuPortalUrlResponse = {
  cu_content_analyzer_id: "rubricContent5c32107a",
  cu_voice_analyzer_id: "rubricVoice5c32107a",
  content_analyzer_url:
    "https://ai.azure.com/resource/contentunderstanding/analyzer-list?wsid=%2Fsubscriptions%2F7a03e9b8&tid=16b3c013",
  voice_analyzer_url:
    "https://ai.azure.com/resource/contentunderstanding/analyzer-list?wsid=%2Fsubscriptions%2F7a03e9b8&tid=16b3c013",
  cu_endpoint: "https://ai-foundary-hu-sweden-central2.services.ai.azure.com",
};

let mockReturnData: CuPortalUrlResponse | null = mockCuPortalData;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        "admin:rubrics.cuAnalyzers": "Content Understanding Analyzers",
        "admin:rubrics.cuNoAnalyzers":
          "CU analyzers will be auto-created when Azure Content Understanding is configured.",
        "admin:rubrics.cuContentAnalyzer": "Content Analyzer",
        "admin:rubrics.cuVoiceAnalyzer": "Voice Analyzer",
        "admin:rubrics.cuViewInPortal": "View in AI Foundry",
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
    expect(screen.getByText("rubricContent5c32107a")).toBeInTheDocument();
  });

  it("displays voice analyzer ID", () => {
    renderComponent("r1");
    expect(screen.getByText("rubricVoice5c32107a")).toBeInTheDocument();
  });

  it("shows CU endpoint", () => {
    renderComponent("r1");
    expect(
      screen.getByText("https://ai-foundary-hu-sweden-central2.services.ai.azure.com"),
    ).toBeInTheDocument();
  });

  it("renders single View in AI Foundry button", () => {
    renderComponent("r1");
    const portalButton = screen.getByText("View in AI Foundry");
    expect(portalButton).toBeInTheDocument();
  });

  it("opens portal URL on click", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    renderComponent("r1");
    const user = userEvent.setup();
    const portalButton = screen.getByText("View in AI Foundry");
    await user.click(portalButton);
    expect(windowOpen).toHaveBeenCalledWith(
      mockCuPortalData.content_analyzer_url,
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
      screen.getByText(
        "CU analyzers will be auto-created when Azure Content Understanding is configured.",
      ),
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

  it("does not show portal button when no URLs available", () => {
    mockReturnData = {
      cu_content_analyzer_id: "rubricContent5c32107a",
      cu_voice_analyzer_id: null,
      content_analyzer_url: null,
      voice_analyzer_url: null,
      cu_endpoint: null,
    };
    renderComponent("r1");
    expect(screen.queryByText("View in AI Foundry")).not.toBeInTheDocument();
    mockReturnData = mockCuPortalData;
  });
});
