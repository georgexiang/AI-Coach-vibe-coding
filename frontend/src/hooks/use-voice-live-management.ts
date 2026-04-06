import { useMutation, useQueryClient } from "@tanstack/react-query";
import { batchSyncAgents } from "@/api/hcp-profiles";

/**
 * Re-export of batch sync mutation, scoped to Voice Live management page.
 * Reuses the existing POST /hcp-profiles/batch-sync endpoint.
 */
export function useBatchResyncAgents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => batchSyncAgents(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}
