import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getServiceConfigs,
  updateServiceConfig,
  testServiceConnection,
} from "@/api/azure-config";
import type { ServiceConfigUpdate } from "@/types/azure-config";

const AZURE_CONFIG_KEY = ["azure-config", "services"] as const;

export function useServiceConfigs() {
  return useQuery({
    queryKey: [...AZURE_CONFIG_KEY],
    queryFn: getServiceConfigs,
  });
}

export function useUpdateServiceConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      serviceName,
      config,
    }: {
      serviceName: string;
      config: ServiceConfigUpdate;
    }) => updateServiceConfig(serviceName, config),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...AZURE_CONFIG_KEY] });
    },
  });
}

export function useTestServiceConnection() {
  return useMutation({
    mutationFn: (serviceName: string) => testServiceConnection(serviceName),
  });
}
