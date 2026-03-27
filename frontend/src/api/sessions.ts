import apiClient from "./client";
import type { CoachingSession, SessionMessage } from "@/types/session";

export async function createSession(scenarioId: string, mode: string = "text") {
  const { data } = await apiClient.post<CoachingSession>("/sessions", {
    scenario_id: scenarioId,
    mode,
  });
  return data;
}

export async function getUserSessions(params?: {
  page?: number;
  page_size?: number;
}) {
  const { data } = await apiClient.get<{
    items: CoachingSession[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }>("/sessions", { params });
  return data;
}

export async function getActiveSession() {
  const { data } = await apiClient.get<CoachingSession>("/sessions/active");
  return data;
}

export async function getSession(id: string) {
  const { data } = await apiClient.get<CoachingSession>(`/sessions/${id}`);
  return data;
}

export async function getSessionMessages(sessionId: string) {
  const { data } = await apiClient.get<SessionMessage[]>(
    `/sessions/${sessionId}/messages`,
  );
  return data;
}

export async function endSession(sessionId: string) {
  const { data } = await apiClient.post<CoachingSession>(
    `/sessions/${sessionId}/end`,
  );
  return data;
}
