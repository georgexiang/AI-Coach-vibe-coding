import { useQuery } from "@tanstack/react-query";
import { getRegionCapabilities } from "@/api/azure-config";

export function useRegionCapabilities(region: string | undefined) {
  return useQuery({
    queryKey: ["azure-config", "region-capabilities", region],
    queryFn: () => getRegionCapabilities(region!),
    enabled: !!region && region.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Limit retries -- region capability is non-critical
  });
}
