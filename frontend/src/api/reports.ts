import apiClient from "./client";
import type { SessionReport, SuggestionResponse } from "@/types/report";

export async function getSessionReport(sessionId: string) {
  const { data } = await apiClient.get<SessionReport>(
    `/scoring/sessions/${sessionId}/report`,
  );
  return data;
}

export async function getSessionSuggestions(sessionId: string) {
  const { data } = await apiClient.get<SuggestionResponse[]>(
    `/scoring/sessions/${sessionId}/suggestions`,
  );
  return data;
}
