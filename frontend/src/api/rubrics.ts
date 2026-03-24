import apiClient from "./client";
import type { Rubric, RubricCreate, RubricUpdate } from "@/types/rubric";

export async function getRubrics(params?: { scenario_type?: string }) {
  const { data } = await apiClient.get<Rubric[]>("/rubrics", { params });
  return data;
}

export async function getRubric(id: string) {
  const { data } = await apiClient.get<Rubric>(`/rubrics/${id}`);
  return data;
}

export async function createRubric(payload: RubricCreate) {
  const { data } = await apiClient.post<Rubric>("/rubrics", payload);
  return data;
}

export async function updateRubric(id: string, payload: RubricUpdate) {
  const { data } = await apiClient.put<Rubric>(`/rubrics/${id}`, payload);
  return data;
}

export async function deleteRubric(id: string) {
  await apiClient.delete(`/rubrics/${id}`);
}
