import apiClient from "./client";
import type { SessionScore } from "@/types/score";

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
