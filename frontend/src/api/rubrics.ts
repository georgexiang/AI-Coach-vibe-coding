import apiClient from "./client";
import type {
  DefaultPromptTemplateResponse,
  DefaultRubricTemplateResponse,
  Rubric,
  RubricCreate,
  RubricUpdate,
} from "@/types/rubric";

export async function getRubrics(params?: { scenario_type?: string }) {
  const { data } = await apiClient.get<Rubric[]>("/rubrics", {
    params,
  });
  return data;
}

export async function getRubric(id: string) {
  const { data } = await apiClient.get<Rubric>(`/rubrics/${id}`);
  return data;
}

export async function getDefaultPromptTemplate() {
  const { data } = await apiClient.get<DefaultPromptTemplateResponse>(
    "/rubrics/default-prompt-template",
  );
  return data;
}

export async function getDefaultRubricTemplate() {
  const { data } = await apiClient.get<DefaultRubricTemplateResponse>(
    "/rubrics/default-rubric-template",
  );
  return data;
}

export async function createRubric(payload: RubricCreate) {
  const { data } = await apiClient.post<Rubric>("/rubrics", payload);
  return data;
}

export async function updateRubric(id: string, payload: RubricUpdate) {
  const { data } = await apiClient.put<Rubric>(
    `/rubrics/${id}`,
    payload,
  );
  return data;
}

export async function deleteRubric(id: string) {
  await apiClient.delete(`/rubrics/${id}`);
}

export interface CuPortalUrlResponse {
  cu_content_analyzer_id: string | null;
  cu_voice_analyzer_id: string | null;
  content_analyzer_url: string | null;
  voice_analyzer_url: string | null;
  cu_endpoint: string | null;
}

export async function getCuPortalUrl(rubricId: string) {
  const { data } = await apiClient.get<CuPortalUrlResponse>(
    `/rubrics/${rubricId}/cu-portal-url`,
  );
  return data;
}
