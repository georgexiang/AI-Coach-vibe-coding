import apiClient from "@/api/client";
import type {
  ServiceConfigResponse,
  ServiceConfigUpdate,
  ConnectionTestResult,
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
