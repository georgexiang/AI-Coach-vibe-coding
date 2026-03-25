import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createConferenceSession,
  endConferenceSession,
  getAudienceHcps,
  getConferenceSession,
  setAudienceHcps,
  updateSubState,
} from "@/api/conference";
import type { AudienceHcpCreate } from "@/types/conference";

export function useConferenceSession(sessionId?: string) {
  return useQuery({
    queryKey: ["conference-sessions", sessionId],
    queryFn: () => getConferenceSession(sessionId!),
    enabled: !!sessionId,
  });
}

export function useCreateConferenceSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scenarioId: string) => createConferenceSession(scenarioId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["conference-sessions"],
      });
    },
  });
}

export function useEndConferenceSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => endConferenceSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["conference-sessions"],
      });
    },
  });
}

export function useUpdateSubState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      subState,
    }: {
      sessionId: string;
      subState: string;
    }) => updateSubState(sessionId, subState),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["conference-sessions"],
      });
    },
  });
}

export function useAudienceHcps(scenarioId?: string) {
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
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["conference-audience"],
      });
    },
  });
}
