import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SessionScore } from "@/types/score";
import apiClient from "@/api/client";

export function useTriggerScoring() {
  const queryClient = useQueryClient();
  return useMutation<SessionScore, Error, string>({
    mutationFn: async (sessionId) => {
      const { data } = await apiClient.post<SessionScore>(
        `/scoring/${sessionId}/trigger`
      );
      return data;
    },
    onSuccess: (_data, sessionId) => {
      void queryClient.invalidateQueries({
        queryKey: ["scoring", sessionId],
      });
    },
  });
}

export function useSessionScore(sessionId: string | undefined) {
  return useQuery<SessionScore>({
    queryKey: ["scoring", sessionId],
    queryFn: async () => {
      const { data } = await apiClient.get<SessionScore>(
        `/scoring/${sessionId}`
      );
      return data;
    },
    enabled: !!sessionId,
  });
}
