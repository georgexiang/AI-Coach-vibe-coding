import { useQuery } from "@tanstack/react-query";
import { getVoiceScoreStatus } from "@/api/unified-session";
import type { VoiceScoreStatus } from "@/types/unified-session";

export function useVoiceScore(sessionId: string | undefined) {
  return useQuery<VoiceScoreStatus>({
    queryKey: ["voice-score", sessionId],
    queryFn: () => getVoiceScoreStatus(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.voice_score_status;
      if (status === "pending" || status === "processing") return 3000;
      return false;
    },
    staleTime: 5000,
  });
}
