import { useQuery } from "@tanstack/react-query";
import { getSessionReport, getSessionSuggestions } from "@/api/reports";

export function useSessionReport(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["reports", sessionId],
    queryFn: () => getSessionReport(sessionId!),
    enabled: !!sessionId,
  });
}

export function useSessionSuggestions(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["suggestions", sessionId],
    queryFn: () => getSessionSuggestions(sessionId!),
    enabled: !!sessionId,
  });
}
