import apiClient from "@/api/client";
import type {
  ServiceConfigResponse,
  ServiceConfigUpdate,
  ConnectionTestResult,
  RegionCapabilities,
  AIFoundryConfig,
  AIFoundryConfigUpdate,
  AIFoundryTestResult,
} from "@/types/azure-config";

export async function getServiceConfigs(): Promise<ServiceConfigResponse[]> {
  const { data } = await apiClient.get<ServiceConfigResponse[]>(
    "/azure-config/services",
  );
  return data;
}

export async function updateServiceConfig(
  serviceName: string,
  config: ServiceConfigUpdate,
): Promise<ServiceConfigResponse> {
  const { data } = await apiClient.put<ServiceConfigResponse>(
    `/azure-config/services/${serviceName}`,
    config,
  );
  return data;
}

export async function testServiceConnection(
  serviceName: string,
): Promise<ConnectionTestResult> {
  const { data } = await apiClient.post<ConnectionTestResult>(
    `/azure-config/services/${serviceName}/test`,
  );
  return data;
}

export async function getRegionCapabilities(
  region: string,
): Promise<RegionCapabilities> {
  const { data } = await apiClient.get<RegionCapabilities>(
    `/azure-config/region-capabilities/${encodeURIComponent(region)}`,
  );
  return data;
}

export async function getAIFoundryConfig(): Promise<AIFoundryConfig> {
  const { data } = await apiClient.get<AIFoundryConfig>(
    "/azure-config/ai-foundry",
  );
  return data;
}

export async function updateAIFoundryConfig(
  config: AIFoundryConfigUpdate,
): Promise<AIFoundryConfig> {
  const { data } = await apiClient.put<AIFoundryConfig>(
    "/azure-config/ai-foundry",
    config,
  );
  return data;
}

export async function testAIFoundryConnection(): Promise<AIFoundryTestResult> {
  const { data } = await apiClient.post<AIFoundryTestResult>(
    "/azure-config/ai-foundry/test",
  );
  return data;
}
