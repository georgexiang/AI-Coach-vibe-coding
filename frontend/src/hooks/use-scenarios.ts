import { useQuery } from "@tanstack/react-query";
import type { Scenario } from "@/types/scenario";
import apiClient from "@/api/client";

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface ActiveScenariosParams {
  mode?: string;
  difficulty?: string;
  product?: string;
  search?: string;
}

export function useActiveScenarios(params?: ActiveScenariosParams) {
  return useQuery<PaginatedResponse<Scenario>>({
    queryKey: ["scenarios", "active", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("status", "active");
      if (params?.mode) searchParams.set("mode", params.mode);
      if (params?.difficulty) searchParams.set("difficulty", params.difficulty);
      if (params?.product) searchParams.set("product", params.product);
      if (params?.search) searchParams.set("search", params.search);
      const { data } = await apiClient.get<PaginatedResponse<Scenario>>(
        `/scenarios?${searchParams.toString()}`
      );
      return data;
    },
  });
}

export function useScenario(id: string | undefined) {
  return useQuery<Scenario>({
    queryKey: ["scenarios", id],
    queryFn: async () => {
      const { data } = await apiClient.get<Scenario>(`/scenarios/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
