import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
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

// Default mock data -- overridden per test via mockUseServiceConfigs
let mockServiceConfigsReturn: {
  data: Array<{
    service_name: string;
    display_name: string;
    endpoint: string;
    masked_key: string;
    model_or_deployment: string;
    region: string;
    is_active: boolean;
    updated_at: string;
  }> | undefined;
  isLoading: boolean;
} = {
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
};

vi.mock("@/hooks/use-azure-config", () => ({
  useServiceConfigs: () => mockServiceConfigsReturn,
  useUpdateServiceConfig: () => ({
    mutate: mockMutate,
  }),
  useTestServiceConnection: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

let mockRegionCapsReturn: {
  data: { region: string; services: Record<string, { available: boolean; note: string }> } | undefined;
  isError: boolean;
} = {
  data: undefined,
  isError: false,
};

vi.mock("@/hooks/use-region-capabilities", () => ({
  useRegionCapabilities: () => mockRegionCapsReturn,
}));

// Use a stub ServiceConfigCard that exposes its props for testing
let capturedProps: Array<{
  service: { key: string; name: string; description: string };
  savedConfig: unknown;
  onSave: (serviceName: string, config: Record<string, string>) => void;
  onTestConnection: (serviceName: string) => Promise<unknown>;
  regionStatus: string | undefined;
}> = [];

vi.mock("@/components/admin/service-config-card", () => ({
  ServiceConfigCard: (props: {
    service: { key: string; name: string; description: string };
    savedConfig: unknown;
    onSave: (serviceName: string, config: Record<string, string>) => void;
    onTestConnection: (serviceName: string) => Promise<unknown>;
    regionStatus: string | undefined;
  }) => {
    capturedProps.push(props);
    return (
      <div data-testid={`service-card-${props.service.name}`}>
        <span>{props.service.name}</span>
        <span>{props.service.description}</span>
        {props.regionStatus && (
          <span data-testid={`region-status-${props.service.key}`}>
            {props.regionStatus}
          </span>
        )}
      </div>
    );
  },
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
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProps = [];
    mockServiceConfigsReturn = {
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
    };
    mockRegionCapsReturn = {
      data: undefined,
      isError: false,
    };
  });

  it("renders the page title", () => {
    renderWithProviders();
    expect(screen.getByText("azureConfig.title")).toBeInTheDocument();
  });

  it("renders Test All Connections button", () => {
    renderWithProviders();
    expect(screen.getByText("Test All Connections")).toBeInTheDocument();
  });

  it("renders all 8 Azure service cards", () => {
    renderWithProviders();
    expect(screen.getByText("Azure OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Azure Speech (STT)")).toBeInTheDocument();
    expect(screen.getByText("Azure Speech (TTS)")).toBeInTheDocument();
    expect(screen.getByText("Azure AI Avatar")).toBeInTheDocument();
    expect(screen.getByText("Azure Content Understanding")).toBeInTheDocument();
    expect(screen.getByText("Azure OpenAI Realtime")).toBeInTheDocument();
    expect(screen.getByText("Azure Voice Live API")).toBeInTheDocument();
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
    expect(screen.getByText("Real-time voice coaching with GPT-4o Realtime")).toBeInTheDocument();
    expect(screen.getByText("Managed PostgreSQL database for production data")).toBeInTheDocument();
  });

  // ---- Loading state ----

  it("shows loading spinner when data is loading", () => {
    mockServiceConfigsReturn = { data: undefined, isLoading: true };
    renderWithProviders();
    // Should not show the title when loading
    expect(screen.queryByText("azureConfig.title")).not.toBeInTheDocument();
    // Should not render service cards
    expect(screen.queryByText("Azure OpenAI")).not.toBeInTheDocument();
  });

  // ---- handleSave ----

  it("calls updateMutation.mutate with correct params via handleSave", () => {
    renderWithProviders();
    // Get the onSave prop from the first captured card
    const firstCard = capturedProps[0];
    expect(firstCard).toBeDefined();

    const config = {
      endpoint: "https://new.endpoint.com",
      api_key: "new-key",
      model_or_deployment: "gpt-4",
      region: "westus",
    };
    firstCard!.onSave("azure_openai", config);

    expect(mockMutate).toHaveBeenCalledWith(
      { serviceName: "azure_openai", config },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("shows success toast on save success", () => {
    renderWithProviders();
    const firstCard = capturedProps[0]!;
    firstCard.onSave("azure_openai", {
      endpoint: "",
      api_key: "",
      model_or_deployment: "",
      region: "",
    });

    // Extract the onSuccess callback and call it
    const mutateCall = mockMutate.mock.calls[0]!;
    const callbacks = mutateCall[1] as { onSuccess: () => void; onError: () => void };
    callbacks.onSuccess();

    expect(toast.success).toHaveBeenCalledWith("Configuration saved");
  });

  it("shows error toast on save failure", () => {
    renderWithProviders();
    const firstCard = capturedProps[0]!;
    firstCard.onSave("azure_openai", {
      endpoint: "",
      api_key: "",
      model_or_deployment: "",
      region: "",
    });

    const mutateCall = mockMutate.mock.calls[0]!;
    const callbacks = mutateCall[1] as { onSuccess: () => void; onError: () => void };
    callbacks.onError();

    expect(toast.error).toHaveBeenCalledWith("Failed to save configuration");
  });

  // ---- handleTestConnection ----

  it("calls testMutation.mutateAsync via handleTestConnection", async () => {
    mockMutateAsync.mockResolvedValue({
      service_name: "azure_openai",
      success: true,
      message: "OK",
    });
    renderWithProviders();
    const firstCard = capturedProps[0]!;

    const result = await firstCard.onTestConnection("azure_openai");

    expect(mockMutateAsync).toHaveBeenCalledWith("azure_openai");
    expect(result).toEqual({
      service_name: "azure_openai",
      success: true,
      message: "OK",
    });
  });

  // ---- handleTestAll ----

  it("tests all configured services when Test All is clicked", async () => {
    mockServiceConfigsReturn = {
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
        {
          service_name: "azure_speech_stt",
          display_name: "Azure Speech STT",
          endpoint: "https://speech.azure.com",
          masked_key: "sp-****",
          model_or_deployment: "",
          region: "eastus",
          is_active: true,
          updated_at: "2026-03-27T00:00:00Z",
        },
      ],
      isLoading: false,
    };

    mockMutateAsync
      .mockResolvedValueOnce({
        service_name: "azure_openai",
        success: true,
        message: "Connected",
      })
      .mockResolvedValueOnce({
        service_name: "azure_speech_stt",
        success: false,
        message: "Invalid key",
      });

    renderWithProviders();

    const testAllButton = screen.getByText("Test All Connections").closest("button")!;
    await userEvent.click(testAllButton);

    await vi.waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    });
    expect(toast.success).toHaveBeenCalledWith("Azure OpenAI: Connected");
    expect(toast.error).toHaveBeenCalledWith("Azure Speech STT: Invalid key");
  });

  it("skips services without endpoints in Test All", async () => {
    mockServiceConfigsReturn = {
      data: [
        {
          service_name: "azure_openai",
          display_name: "Azure OpenAI",
          endpoint: "", // No endpoint configured
          masked_key: "",
          model_or_deployment: "",
          region: "",
          is_active: false,
          updated_at: "2026-03-27T00:00:00Z",
        },
      ],
      isLoading: false,
    };

    renderWithProviders();
    await userEvent.click(screen.getByText("Test All Connections").closest("button")!);

    await vi.waitFor(() => {
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });

  it("shows error toast when individual test in Test All throws", async () => {
    mockServiceConfigsReturn = {
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
    };

    mockMutateAsync.mockRejectedValue(new Error("Network error"));

    renderWithProviders();
    await userEvent.click(screen.getByText("Test All Connections").closest("button")!);

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Azure OpenAI: Connection failed");
    });
  });

  // ---- Region status display ----

  it("passes regionStatus 'available' when regionCaps shows service available", () => {
    mockRegionCapsReturn = {
      data: {
        region: "eastus",
        services: {
          azure_openai: { available: true, note: "" },
        },
      },
      isError: false,
    };
    renderWithProviders();

    // Find the Azure OpenAI card's regionStatus
    const openAICard = capturedProps.find(
      (p) => p.service.key === "azure_openai",
    );
    expect(openAICard?.regionStatus).toBe("available");
  });

  it("passes regionStatus 'unavailable' when regionCaps shows service unavailable", () => {
    mockRegionCapsReturn = {
      data: {
        region: "eastus",
        services: {
          azure_openai: { available: false, note: "" },
        },
      },
      isError: false,
    };
    renderWithProviders();

    const openAICard = capturedProps.find(
      (p) => p.service.key === "azure_openai",
    );
    expect(openAICard?.regionStatus).toBe("unavailable");
  });

  it("passes regionStatus 'unknown' when regionCaps has error", () => {
    mockRegionCapsReturn = {
      data: undefined,
      isError: true,
    };
    renderWithProviders();

    const openAICard = capturedProps.find(
      (p) => p.service.key === "azure_openai",
    );
    expect(openAICard?.regionStatus).toBe("unknown");
  });

  it("passes regionStatus 'unknown' when service not in regionCaps", () => {
    mockRegionCapsReturn = {
      data: {
        region: "eastus",
        services: {
          // azure_openai not present
        },
      },
      isError: false,
    };
    renderWithProviders();

    const openAICard = capturedProps.find(
      (p) => p.service.key === "azure_openai",
    );
    expect(openAICard?.regionStatus).toBe("unknown");
  });

  it("passes undefined regionStatus when no primary region is set", () => {
    mockServiceConfigsReturn = {
      data: [
        {
          service_name: "azure_openai",
          display_name: "Azure OpenAI",
          endpoint: "https://test.openai.azure.com",
          masked_key: "sk-****",
          model_or_deployment: "gpt-4o",
          region: "", // no region
          is_active: true,
          updated_at: "2026-03-27T00:00:00Z",
        },
      ],
      isLoading: false,
    };
    renderWithProviders();

    const openAICard = capturedProps.find(
      (p) => p.service.key === "azure_openai",
    );
    expect(openAICard?.regionStatus).toBeUndefined();
  });

  // ---- getSavedConfig mapping ----

  it("passes correct savedConfig to cards based on SERVICE_KEY_MAP", () => {
    mockServiceConfigsReturn = {
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
        {
          service_name: "azure_voice_live",
          display_name: "Azure Voice Live",
          endpoint: "https://voice.azure.com",
          masked_key: "vl-****",
          model_or_deployment: "gpt-4o-realtime",
          region: "westus",
          is_active: false,
          updated_at: "2026-03-27T00:00:00Z",
        },
      ],
      isLoading: false,
    };
    renderWithProviders();

    const openAICard = capturedProps.find(
      (p) => p.service.key === "azure_openai",
    );
    expect(openAICard?.savedConfig).toEqual(
      expect.objectContaining({ service_name: "azure_openai" }),
    );

    const voiceLiveCard = capturedProps.find(
      (p) => p.service.key === "azure_voice_live",
    );
    expect(voiceLiveCard?.savedConfig).toEqual(
      expect.objectContaining({ service_name: "azure_voice_live" }),
    );
  });

  it("passes undefined savedConfig when no matching config exists", () => {
    mockServiceConfigsReturn = {
      data: [],
      isLoading: false,
    };
    renderWithProviders();

    const openAICard = capturedProps.find(
      (p) => p.service.key === "azure_openai",
    );
    expect(openAICard?.savedConfig).toBeUndefined();
  });
});
