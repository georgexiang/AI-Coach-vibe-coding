import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchVoiceLiveToken, fetchVoiceLiveStatus } from "@/api/voice-live";
import type { VoiceLiveToken, VoiceLiveConfigStatus } from "@/types/voice-live";

export function useVoiceToken() {
  return useMutation<VoiceLiveToken, Error, string | undefined>({
    mutationFn: (hcpProfileId?: string) => fetchVoiceLiveToken(hcpProfileId),
  });
}

export function useVoiceLiveStatus() {
  return useQuery<VoiceLiveConfigStatus, Error>({
    queryKey: ["voice-live", "status"],
    queryFn: fetchVoiceLiveStatus,
    staleTime: 30_000,
    retry: 1,
  });
}
