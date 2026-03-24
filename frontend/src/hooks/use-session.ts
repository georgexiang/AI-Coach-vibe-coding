import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSession,
  getUserSessions,
  getSession,
  getSessionMessages,
  endSession,
} from "@/api/sessions";

export function useUserSessions(params?: {
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["sessions", params],
    queryFn: () => getUserSessions(params),
  });
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ["sessions", id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });
}

export function useSessionMessages(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["sessions", sessionId, "messages"],
    queryFn: () => getSessionMessages(sessionId!),
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scenarioId: string) => createSession(scenarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => endSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
