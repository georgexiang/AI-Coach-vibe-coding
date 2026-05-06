import apiClient from "./client";
import type { Scenario, ScenarioCreate, ScenarioUpdate } from "@/types/scenario";

export async function getScenarios(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  mode?: string;
  search?: string;
}) {
  const { data } = await apiClient.get<{
    items: Scenario[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }>("/scenarios", { params });
  return data;
}

export async function getActiveScenarios(params?: {
  mode?: string;
}) {
  const { data } = await apiClient.get<Scenario[]>("/scenarios/active", { params });
  return data;
}

export async function getScenario(id: string) {
  const { data } = await apiClient.get<Scenario>(`/scenarios/${id}`);
  return data;
}

export async function createScenario(scenario: ScenarioCreate) {
  const { data } = await apiClient.post<Scenario>("/scenarios", scenario);
  return data;
}

export async function updateScenario(id: string, scenario: ScenarioUpdate) {
  const { data } = await apiClient.put<Scenario>(
    `/scenarios/${id}`,
    scenario,
  );
  return data;
}

export async function deleteScenario(id: string) {
  await apiClient.delete(`/scenarios/${id}`);
}

export async function cloneScenario(id: string) {
  const { data } = await apiClient.post<Scenario>(`/scenarios/${id}/clone`);
  return data;
}
