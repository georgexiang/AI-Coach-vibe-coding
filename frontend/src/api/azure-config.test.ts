import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getServiceConfigs,
  updateServiceConfig,
  testServiceConnection,
  getRegionCapabilities,
  getAIFoundryConfig,
  updateAIFoundryConfig,
  testAIFoundryConnection,
} from "./azure-config";

// Mock the apiClient module
vi.mock("@/api/client", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

import apiClient from "@/api/client";

const mockedGet = vi.mocked(apiClient.get);
const mockedPut = vi.mocked(apiClient.put);
const mockedPost = vi.mocked(apiClient.post);

describe("azure-config API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getServiceConfigs", () => {
    it("calls GET /azure-config/services and returns data", async () => {
      const mockData = [
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
      mockedGet.mockResolvedValue({ data: mockData });

      const result = await getServiceConfigs();

      expect(mockedGet).toHaveBeenCalledWith("/azure-config/services");
      expect(result).toEqual(mockData);
    });

    it("propagates errors from the API client", async () => {
      mockedGet.mockRejectedValue(new Error("Network error"));

      await expect(getServiceConfigs()).rejects.toThrow("Network error");
    });
  });

  describe("updateServiceConfig", () => {
    it("calls PUT /azure-config/services/:serviceName with config payload", async () => {
      const mockResponse = {
        service_name: "azure_openai",
        display_name: "Azure OpenAI",
        endpoint: "https://new.openai.azure.com",
        masked_key: "sk-****new",
        model_or_deployment: "gpt-4o",
        region: "westus",
        is_active: true,
        updated_at: "2026-03-28T00:00:00Z",
      };
      mockedPut.mockResolvedValue({ data: mockResponse });

      const config = {
        endpoint: "https://new.openai.azure.com",
        api_key: "sk-new-key",
        model_or_deployment: "gpt-4o",
        region: "westus",
      };
      const result = await updateServiceConfig("azure_openai", config);

      expect(mockedPut).toHaveBeenCalledWith(
        "/azure-config/services/azure_openai",
        config,
      );
      expect(result).toEqual(mockResponse);
    });

    it("propagates errors from the API client", async () => {
      mockedPut.mockRejectedValue(new Error("Forbidden"));

      await expect(
        updateServiceConfig("azure_openai", {
          endpoint: "",
          api_key: "",
          model_or_deployment: "",
          region: "",
        }),
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("testServiceConnection", () => {
    it("calls POST /azure-config/services/:serviceName/test and returns result", async () => {
      const mockResult = {
        service_name: "azure_openai",
        success: true,
        message: "Connection successful",
      };
      mockedPost.mockResolvedValue({ data: mockResult });

      const result = await testServiceConnection("azure_openai");

      expect(mockedPost).toHaveBeenCalledWith(
        "/azure-config/services/azure_openai/test",
      );
      expect(result).toEqual(mockResult);
    });

    it("returns failure result when connection fails", async () => {
      const mockResult = {
        service_name: "azure_openai",
        success: false,
        message: "Invalid API key",
      };
      mockedPost.mockResolvedValue({ data: mockResult });

      const result = await testServiceConnection("azure_openai");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid API key");
    });

    it("propagates errors from the API client", async () => {
      mockedPost.mockRejectedValue(new Error("Server error"));

      await expect(testServiceConnection("azure_openai")).rejects.toThrow(
        "Server error",
      );
    });
  });

  describe("getRegionCapabilities", () => {
    it("calls GET /azure-config/region-capabilities/:region and returns data", async () => {
      const mockCaps = {
        region: "eastus",
        services: {
          azure_openai: { available: true, note: "" },
          azure_speech_stt: { available: true, note: "" },
        },
      };
      mockedGet.mockResolvedValue({ data: mockCaps });

      const result = await getRegionCapabilities("eastus");

      expect(mockedGet).toHaveBeenCalledWith(
        "/azure-config/region-capabilities/eastus",
      );
      expect(result).toEqual(mockCaps);
    });

    it("encodes region names with special characters", async () => {
      mockedGet.mockResolvedValue({
        data: { region: "east us", services: {} },
      });

      await getRegionCapabilities("east us");

      expect(mockedGet).toHaveBeenCalledWith(
        "/azure-config/region-capabilities/east%20us",
      );
    });

    it("propagates errors from the API client", async () => {
      mockedGet.mockRejectedValue(new Error("Not found"));

      await expect(getRegionCapabilities("invalidregion")).rejects.toThrow(
        "Not found",
      );
    });
  });

  describe("getAIFoundryConfig", () => {
    it("calls GET /azure-config/ai-foundry and returns config", async () => {
      const mockConfig = {
        endpoint: "https://ai-foundry.azure.com",
        project_name: "my-project",
        api_key_set: true,
        is_active: true,
      };
      mockedGet.mockResolvedValue({ data: mockConfig });

      const result = await getAIFoundryConfig();

      expect(mockedGet).toHaveBeenCalledWith("/azure-config/ai-foundry");
      expect(result).toEqual(mockConfig);
    });

    it("propagates errors from the API client", async () => {
      mockedGet.mockRejectedValue(new Error("Network error"));

      await expect(getAIFoundryConfig()).rejects.toThrow("Network error");
    });
  });

  describe("updateAIFoundryConfig", () => {
    it("calls PUT /azure-config/ai-foundry with config payload", async () => {
      const mockResponse = {
        endpoint: "https://new-foundry.azure.com",
        project_name: "updated-project",
        api_key_set: true,
        is_active: true,
      };
      mockedPut.mockResolvedValue({ data: mockResponse });

      const config = {
        endpoint: "https://new-foundry.azure.com",
        api_key: "new-key-123",
        project_name: "updated-project",
      };
      const result = await updateAIFoundryConfig(config as never);

      expect(mockedPut).toHaveBeenCalledWith("/azure-config/ai-foundry", config);
      expect(result).toEqual(mockResponse);
    });

    it("propagates errors from the API client", async () => {
      mockedPut.mockRejectedValue(new Error("422 Validation Error"));

      await expect(
        updateAIFoundryConfig({ endpoint: "" } as never),
      ).rejects.toThrow("422 Validation Error");
    });
  });

  describe("testAIFoundryConnection", () => {
    it("calls POST /azure-config/ai-foundry/test and returns success result", async () => {
      const mockResult = {
        success: true,
        message: "AI Foundry connection successful",
        services_discovered: ["openai", "speech"],
      };
      mockedPost.mockResolvedValue({ data: mockResult });

      const result = await testAIFoundryConnection();

      expect(mockedPost).toHaveBeenCalledWith("/azure-config/ai-foundry/test");
      expect(result.success).toBe(true);
    });

    it("returns failure result when connection fails", async () => {
      const mockResult = {
        success: false,
        message: "Invalid endpoint or API key",
      };
      mockedPost.mockResolvedValue({ data: mockResult });

      const result = await testAIFoundryConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid endpoint or API key");
    });

    it("propagates errors from the API client", async () => {
      mockedPost.mockRejectedValue(new Error("Server error"));

      await expect(testAIFoundryConnection()).rejects.toThrow("Server error");
    });
  });
});
