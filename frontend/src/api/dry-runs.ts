import apiClient from "./client";
import type { DryRun, DryRunStatusResponse, PaginatedDryRuns } from "@/types/dry-run";

export async function createDryRun(skillId: string): Promise<DryRun> {
  const { data } = await apiClient.post<DryRun>(`/skills/${skillId}/dry-runs`);
  return data;
}

export async function getDryRuns(skillId: string, params?: { page?: number; page_size?: number }): Promise<PaginatedDryRuns> {
  const { data } = await apiClient.get<PaginatedDryRuns>(`/skills/${skillId}/dry-runs`, { params });
  return data;
}

export async function getDryRun(skillId: string, runId: string): Promise<DryRun> {
  const { data } = await apiClient.get<DryRun>(`/skills/${skillId}/dry-runs/${runId}`);
  return data;
}

export async function getDryRunStatus(skillId: string, runId: string): Promise<DryRunStatusResponse> {
  const { data } = await apiClient.get<DryRunStatusResponse>(`/skills/${skillId}/dry-runs/${runId}/status`);
  return data;
}

export async function cancelDryRun(skillId: string, runId: string): Promise<DryRun> {
  const { data } = await apiClient.post<DryRun>(`/skills/${skillId}/dry-runs/${runId}/cancel`);
  return data;
}
