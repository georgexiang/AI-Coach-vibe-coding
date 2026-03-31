import apiClient from "./client";
import type { HcpProfile, HcpProfileCreate, HcpProfileUpdate } from "@/types/hcp";

export async function getHcpProfiles(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
}) {
  const { data } = await apiClient.get<{
    items: HcpProfile[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }>("/hcp-profiles", { params });
  return data;
}

export async function getHcpProfile(id: string) {
  const { data } = await apiClient.get<HcpProfile>(`/hcp-profiles/${id}`);
  return data;
}

export async function createHcpProfile(profile: HcpProfileCreate) {
  const { data } = await apiClient.post<HcpProfile>("/hcp-profiles", profile);
  return data;
}

export async function updateHcpProfile(id: string, profile: HcpProfileUpdate) {
  const { data } = await apiClient.put<HcpProfile>(
    `/hcp-profiles/${id}`,
    profile,
  );
  return data;
}

export async function deleteHcpProfile(id: string) {
  await apiClient.delete(`/hcp-profiles/${id}`);
}

export async function retrySyncHcpProfile(id: string) {
  const { data } = await apiClient.post<HcpProfile>(
    `/hcp-profiles/${id}/retry-sync`,
  );
  return data;
}

export async function batchSyncAgents() {
  const { data } = await apiClient.post<{
    synced: number;
    failed: number;
    total: number;
    error?: string;
  }>("/hcp-profiles/batch-sync");
  return data;
}

export interface TestChatRequest {
  message: string;
  previous_response_id?: string;
}

export interface TestChatResponse {
  response_text: string;
  response_id: string;
  agent_name: string;
  agent_version: string;
}

export async function testChatWithAgent(
  profileId: string,
  body: TestChatRequest,
) {
  const { data } = await apiClient.post<TestChatResponse>(
    `/hcp-profiles/${profileId}/test-chat`,
    body,
  );
  return data;
}

export interface AgentPortalUrlResponse {
  url: string;
  agent_name: string;
  agent_version: string;
}

export async function getAgentPortalUrl(profileId: string) {
  const { data } = await apiClient.get<AgentPortalUrlResponse>(
    `/hcp-profiles/${profileId}/portal-url`,
  );
  return data;
}
