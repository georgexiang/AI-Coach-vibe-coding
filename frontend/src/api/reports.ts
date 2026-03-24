import apiClient from "./client";
import type { SessionReport, SuggestionResponse } from "@/types/report";

export async function getSessionReport(sessionId: string) {
  const { data } = await apiClient.get<SessionReport>(
    `/sessions/${sessionId}/report`,
  );
  return data;
}

export async function getSessionSuggestions(sessionId: string) {
  const { data } = await apiClient.get<SuggestionResponse[]>(
    `/sessions/${sessionId}/suggestions`,
  );
  return data;
}
