import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { knowledgeBaseApi } from "@/api/knowledge-base";
import type { KnowledgeConfigCreate } from "@/types/knowledge-base";

export function useSearchConnections() {
  return useQuery({
    queryKey: ["knowledge-base", "connections"],
    queryFn: knowledgeBaseApi.listConnections,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSearchIndexes() {
  return useQuery({
    queryKey: ["knowledge-base", "indexes"],
    queryFn: knowledgeBaseApi.listIndexes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useHcpKnowledgeConfigs(hcpId: string | undefined) {
  return useQuery({
    queryKey: ["knowledge-base", "hcp", hcpId, "configs"],
    queryFn: () => knowledgeBaseApi.getHcpConfigs(hcpId!),
    enabled: !!hcpId,
  });
}

export function useAddKnowledgeConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      hcpId,
      data,
    }: {
      hcpId: string;
      data: KnowledgeConfigCreate;
    }) => knowledgeBaseApi.addHcpConfig(hcpId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["knowledge-base", "hcp", variables.hcpId, "configs"],
      });
    },
  });
}

export function useRemoveKnowledgeConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (configId: string) => knowledgeBaseApi.removeConfig(configId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["knowledge-base"],
      });
    },
  });
}
