import apiClient from "@/api/client";
import type {
  AudienceHcp,
  AudienceHcpCreate,
  ConferenceSession,
  ConferenceSubState,
} from "@/types/conference";

/** Backend audience HCP response shape (snake_case). */
interface AudienceHcpApi {
  id: string;
  scenario_id: string;
  hcp_profile_id: string;
  role_in_conference: string;
  voice_id: string;
  sort_order: number;
  hcp_name?: string;
  hcp_specialty?: string;
}

/** Backend audience HCP create payload (snake_case). */
interface AudienceHcpCreateApi {
  hcp_profile_id: string;
  role_in_conference: string;
  voice_id: string;
  sort_order: number;
}

interface ConferenceSessionApi {
  id: string;
  user_id: string;
  scenario_id: string;
  status: string;
  mode: string;
  session_type: "conference";
  sub_state: ConferenceSubState;
  presentation_topic: string | null;
  audience_config: string | null;
  key_messages_status: string | null;
  created_at: string | null;
}

function toAudienceHcp(raw: AudienceHcpApi): AudienceHcp {
  return {
    id: raw.id,
    scenarioId: raw.scenario_id,
    hcpProfileId: raw.hcp_profile_id,
    hcpName: raw.hcp_name ?? "",
    hcpSpecialty: raw.hcp_specialty ?? "",
    roleInConference: raw.role_in_conference,
    voiceId: raw.voice_id,
    sortOrder: raw.sort_order,
    status: "listening",
  };
}

function toConferenceSession(raw: ConferenceSessionApi): ConferenceSession {
  return {
    id: raw.id,
    userId: raw.user_id,
    scenarioId: raw.scenario_id,
    status: raw.status,
    mode: raw.mode,
    sessionType: raw.session_type,
    subState: raw.sub_state,
    presentationTopic: raw.presentation_topic,
    audienceConfig: raw.audience_config,
    keyMessagesStatus: raw.key_messages_status,
    createdAt: raw.created_at,
  };
}

function toAudienceHcpCreateApi(
  hcp: AudienceHcpCreate,
  index: number,
): AudienceHcpCreateApi {
  return {
    hcp_profile_id: hcp.hcpProfileId,
    role_in_conference: hcp.roleInConference ?? "audience",
    voice_id: hcp.voiceId ?? "",
    sort_order: hcp.sortOrder ?? index,
  };
}

export async function createConferenceSession(
  scenarioId: string,
  mode: string = "text",
): Promise<ConferenceSession> {
  const { data } = await apiClient.post<ConferenceSessionApi>(
    "/conference/sessions",
    { scenario_id: scenarioId, mode },
  );
  return toConferenceSession(data);
}

export async function getConferenceSession(
  sessionId: string,
): Promise<ConferenceSession> {
  const { data } = await apiClient.get<ConferenceSessionApi>(
    `/conference/sessions/${sessionId}`,
  );
  return toConferenceSession(data);
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
  const { data } = await apiClient.get<AudienceHcpApi[]>(
    `/conference/scenarios/${scenarioId}/audience`,
  );
  return data.map(toAudienceHcp);
}

export async function setAudienceHcps(
  scenarioId: string,
  hcps: AudienceHcpCreate[],
): Promise<AudienceHcp[]> {
  const payload = hcps.map(toAudienceHcpCreateApi);
  const { data } = await apiClient.put<AudienceHcpApi[]>(
    `/conference/scenarios/${scenarioId}/audience`,
    payload,
  );
  return data.map(toAudienceHcp);
}
