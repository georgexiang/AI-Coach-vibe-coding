import { useQuery } from "@tanstack/react-query";
import apiClient from "@/api/client";
import type { AppConfig } from "@/types/config";

export function useFeatureFlags(isAuthenticated: boolean = false) {
  return useQuery({
    queryKey: ["config", "features"],
    queryFn: async () => {
      const res = await apiClient.get<AppConfig>("/config/features");
      return res.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes -- feature flags don't change often
    retry: 1,
    enabled: isAuthenticated,
  });
}
