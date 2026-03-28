import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useServiceConfigs,
  useUpdateServiceConfig,
  useTestServiceConnection,
} from "./use-azure-config";

// Mock the API module
vi.mock("@/api/azure-config", () => ({
  getServiceConfigs: vi.fn(),
  updateServiceConfig: vi.fn(),
  testServiceConnection: vi.fn(),
}));

import {
  getServiceConfigs,
  updateServiceConfig,
  testServiceConnection,
} from "@/api/azure-config";

const mockedGetServiceConfigs = vi.mocked(getServiceConfigs);
const mockedUpdateServiceConfig = vi.mocked(updateServiceConfig);
const mockedTestServiceConnection = vi.mocked(testServiceConnection);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe("useServiceConfigs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches service configs and returns data", async () => {
    const mockConfigs = [
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
    ];
    mockedGetServiceConfigs.mockResolvedValue(mockConfigs);

    const { result } = renderHook(() => useServiceConfigs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockConfigs);
    expect(mockedGetServiceConfigs).toHaveBeenCalledTimes(1);
  });

  it("returns error state when fetch fails", async () => {
    mockedGetServiceConfigs.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useServiceConfigs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });

  it("returns loading state initially", () => {
    mockedGetServiceConfigs.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useServiceConfigs(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe("useUpdateServiceConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls updateServiceConfig with correct params on mutate", async () => {
    const mockResponse = {
      service_name: "azure_openai",
      display_name: "Azure OpenAI",
      endpoint: "https://new.endpoint.com",
      masked_key: "sk-****new",
      model_or_deployment: "gpt-4o",
      region: "westus",
      is_active: true,
      updated_at: "2026-03-28T00:00:00Z",
    };
    mockedUpdateServiceConfig.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useUpdateServiceConfig(), {
      wrapper: createWrapper(),
    });

    const config = {
      endpoint: "https://new.endpoint.com",
      api_key: "new-key",
      model_or_deployment: "gpt-4o",
      region: "westus",
    };

    result.current.mutate({ serviceName: "azure_openai", config });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedUpdateServiceConfig).toHaveBeenCalledWith(
      "azure_openai",
      config,
    );
  });

  it("sets error state when mutation fails", async () => {
    mockedUpdateServiceConfig.mockRejectedValue(new Error("Save failed"));

    const { result } = renderHook(() => useUpdateServiceConfig(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      serviceName: "azure_openai",
      config: {
        endpoint: "",
        api_key: "",
        model_or_deployment: "",
        region: "",
      },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useTestServiceConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls testServiceConnection with service name on mutate", async () => {
    const mockResult = {
      service_name: "azure_openai",
      success: true,
      message: "Connected successfully",
    };
    mockedTestServiceConnection.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useTestServiceConnection(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("azure_openai");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedTestServiceConnection).toHaveBeenCalledWith("azure_openai");
    expect(result.current.data).toEqual(mockResult);
  });

  it("supports mutateAsync for promise-based usage", async () => {
    const mockResult = {
      service_name: "azure_speech_stt",
      success: false,
      message: "Invalid key",
    };
    mockedTestServiceConnection.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useTestServiceConnection(), {
      wrapper: createWrapper(),
    });

    const response = await result.current.mutateAsync("azure_speech_stt");

    expect(response).toEqual(mockResult);
    expect(mockedTestServiceConnection).toHaveBeenCalledWith(
      "azure_speech_stt",
    );
  });

  it("sets error state when test fails", async () => {
    mockedTestServiceConnection.mockRejectedValue(
      new Error("Connection refused"),
    );

    const { result } = renderHook(() => useTestServiceConnection(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("azure_openai");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
