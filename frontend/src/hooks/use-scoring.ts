import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { triggerScoring, getSessionScore } from "@/api/scoring";

export function useSessionScore(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["scoring", sessionId],
    queryFn: () => getSessionScore(sessionId!),
    enabled: !!sessionId,
  });
}

export function useTriggerScoring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => triggerScoring(sessionId),
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["scoring", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] });
    },
  });
}
