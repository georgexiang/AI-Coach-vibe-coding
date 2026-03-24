import apiClient from "./client";
import type { SessionScore } from "@/types/score";
import type { ScoreHistoryItem } from "@/types/report";

export async function triggerScoring(sessionId: string) {
  const { data } = await apiClient.post<SessionScore>(
    `/scoring/sessions/${sessionId}/score`,
  );
  return data;
}

export async function getSessionScore(sessionId: string) {
  const { data } = await apiClient.get<SessionScore>(
    `/scoring/sessions/${sessionId}/score`,
  );
  return data;
}

export async function getScoreHistory(limit?: number) {
  const { data } = await apiClient.get<ScoreHistoryItem[]>(
    "/scoring/history",
    { params: limit ? { limit } : undefined },
  );
  return data;
}
