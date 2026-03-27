import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AzureConfigPage from "./azure-config";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockMutate = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("@/hooks/use-azure-config", () => ({
  useServiceConfigs: () => ({
    data: [
      {
        service_name: "azure_openai",
        display_name: "Azure OpenAI",
        endpoint: "https://test.openai.azure.com",
        masked_key: "sk-****",
        model_or_deployment: "gpt-4o",
        region: "eastus",
        is_active: true,
        updated_at: "2026-03-27T00:00:00Z",
      },
    ],
    isLoading: false,
  }),
  useUpdateServiceConfig: () => ({
    mutate: mockMutate,
  }),
  useTestServiceConnection: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

vi.mock("@/components/admin/service-config-card", () => ({
  ServiceConfigCard: (props: {
    service: { key: string; name: string; description: string };
  }) => (
    <div data-testid={`service-card-${props.service.name}`}>
      <span>{props.service.name}</span>
      <span>{props.service.description}</span>
    </div>
  ),
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AzureConfigPage />
    </QueryClientProvider>,
  );
}

describe("AzureConfigPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the page title", () => {
    renderWithProviders();
    expect(screen.getByText("azureConfig.title")).toBeInTheDocument();
  });

  it("renders Test All Connections button", () => {
    renderWithProviders();
    expect(screen.getByText("Test All Connections")).toBeInTheDocument();
  });

  it("renders all 7 Azure service cards", () => {
    renderWithProviders();
    expect(screen.getByText("Azure OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Azure Speech (STT)")).toBeInTheDocument();
    expect(screen.getByText("Azure Speech (TTS)")).toBeInTheDocument();
    expect(screen.getByText("Azure AI Avatar")).toBeInTheDocument();
    expect(screen.getByText("Azure Content Understanding")).toBeInTheDocument();
    expect(screen.getByText("Azure OpenAI Realtime")).toBeInTheDocument();
    expect(screen.getByText("Azure Database for PostgreSQL")).toBeInTheDocument();
  });

  it("renders all service descriptions", () => {
    renderWithProviders();
    expect(screen.getByText("GPT-4o for AI coaching conversations and scoring")).toBeInTheDocument();
    expect(screen.getByText("Speech-to-text for voice input recognition")).toBeInTheDocument();
    expect(screen.getByText("Text-to-speech for HCP voice responses")).toBeInTheDocument();
    expect(screen.getByText("Digital human avatar for HCP visualization")).toBeInTheDocument();
    expect(screen.getByText("Multimodal evaluation for training materials")).toBeInTheDocument();
    expect(screen.getByText("Real-time audio streaming for voice conversations")).toBeInTheDocument();
    expect(screen.getByText("Managed PostgreSQL database for production data")).toBeInTheDocument();
  });
});
