import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAudienceHcps, setAudienceHcps } from "@/api/conference";
import type { AudienceHcpCreate } from "@/types/conference";

export function useAudienceHcps(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["conference-audience", scenarioId],
    queryFn: () => getAudienceHcps(scenarioId!),
    enabled: !!scenarioId,
  });
}

export function useSetAudienceHcps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scenarioId,
      hcps,
    }: {
      scenarioId: string;
      hcps: AudienceHcpCreate[];
    }) => setAudienceHcps(scenarioId, hcps),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["conference-audience", variables.scenarioId],
      });
    },
  });
}
