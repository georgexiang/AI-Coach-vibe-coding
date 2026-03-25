import apiClient from "@/api/client";
import type {
  AudienceHcp,
  AudienceHcpCreate,
  ConferenceSession,
} from "@/types/conference";

export async function createConferenceSession(
  scenarioId: string,
): Promise<ConferenceSession> {
  const { data } = await apiClient.post<ConferenceSession>(
    "/conference/sessions",
    { scenario_id: scenarioId },
  );
  return data;
}

export async function getConferenceSession(
  sessionId: string,
): Promise<ConferenceSession> {
  const { data } = await apiClient.get<ConferenceSession>(
    `/conference/sessions/${sessionId}`,
  );
  return data;
}

export async function updateSubState(
  sessionId: string,
  subState: string,
): Promise<void> {
  await apiClient.patch(`/conference/sessions/${sessionId}/sub-state`, {
    sub_state: subState,
  });
}

export async function endConferenceSession(
  sessionId: string,
): Promise<void> {
  await apiClient.post(`/conference/sessions/${sessionId}/end`);
}

export async function getAudienceHcps(
  scenarioId: string,
): Promise<AudienceHcp[]> {
  const { data } = await apiClient.get<AudienceHcp[]>(
    `/conference/scenarios/${scenarioId}/audience`,
  );
  return data;
}

export async function setAudienceHcps(
  scenarioId: string,
  hcps: AudienceHcpCreate[],
): Promise<AudienceHcp[]> {
  const { data } = await apiClient.put<AudienceHcp[]>(
    `/conference/scenarios/${scenarioId}/audience`,
    hcps,
  );
  return data;
}
