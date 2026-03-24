import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CoachingSession, SessionMessage } from "@/types/session";
import apiClient from "@/api/client";

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation<CoachingSession, Error, { scenario_id: string }>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post<CoachingSession>("/sessions", payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useSession(id: string | undefined) {
  return useQuery<CoachingSession>({
    queryKey: ["sessions", id],
    queryFn: async () => {
      const { data } = await apiClient.get<CoachingSession>(`/sessions/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useSessionMessages(sessionId: string | undefined) {
  return useQuery<SessionMessage[]>({
    queryKey: ["sessions", sessionId, "messages"],
    queryFn: async () => {
      const { data } = await apiClient.get<SessionMessage[]>(
        `/sessions/${sessionId}/messages`
      );
      return data;
    },
    enabled: !!sessionId,
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();
  return useMutation<CoachingSession, Error, string>({
    mutationFn: async (sessionId) => {
      const { data } = await apiClient.post<CoachingSession>(
        `/sessions/${sessionId}/end`
      );
      return data;
    },
    onSuccess: (_data, sessionId) => {
      void queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] });
    },
  });
}
