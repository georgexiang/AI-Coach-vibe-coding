import apiClient from "./client";
import type {
  PaginatedSkills,
  Skill,
  SkillCreate,
  SkillResource,
  SkillUpdate,
  StructureCheckResult,
  QualityEvaluation,
  ResourceType,
} from "@/types/skill";

// ---------------------------------------------------------------------------
// Skill CRUD
// ---------------------------------------------------------------------------

export async function getSkills(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  product?: string;
  search?: string;
}): Promise<PaginatedSkills> {
  const { data } = await apiClient.get<PaginatedSkills>("/skills", { params });
  return data;
}

export async function getPublishedSkills(params?: {
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<PaginatedSkills> {
  const { data } = await apiClient.get<PaginatedSkills>("/skills/published", {
    params,
  });
  return data;
}

export async function getSkill(id: string): Promise<Skill> {
  const { data } = await apiClient.get<Skill>(`/skills/${id}`);
  return data;
}

export async function createSkill(payload: SkillCreate): Promise<Skill> {
  const { data } = await apiClient.post<Skill>("/skills", payload);
  return data;
}

export async function updateSkill(
  id: string,
  payload: SkillUpdate,
): Promise<Skill> {
  const { data } = await apiClient.put<Skill>(`/skills/${id}`, payload);
  return data;
}

export async function deleteSkill(id: string): Promise<void> {
  await apiClient.delete(`/skills/${id}`);
}

// ---------------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------------

export async function publishSkill(id: string): Promise<Skill> {
  const { data } = await apiClient.post<Skill>(`/skills/${id}/publish`);
  return data;
}

export async function archiveSkill(id: string): Promise<Skill> {
  const { data } = await apiClient.post<Skill>(`/skills/${id}/archive`);
  return data;
}

export async function restoreSkill(id: string): Promise<Skill> {
  const { data } = await apiClient.post<Skill>(`/skills/${id}/restore`);
  return data;
}

export async function createNewVersion(id: string): Promise<Skill> {
  const { data } = await apiClient.post<Skill>(`/skills/${id}/new-version`);
  return data;
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

export async function startConversion(id: string): Promise<Skill> {
  const { data } = await apiClient.post<Skill>(`/skills/${id}/convert`);
  return data;
}

export async function retryConversion(id: string): Promise<Skill> {
  const { data } = await apiClient.post<Skill>(`/skills/${id}/convert/retry`);
  return data;
}

export async function getConversionStatus(
  id: string,
): Promise<{ status: string; error: string | null }> {
  const { data } = await apiClient.get<{
    status: string;
    error: string | null;
  }>(`/skills/${id}/convert/status`);
  return data;
}

export async function uploadAndConvert(
  id: string,
  files: File[],
): Promise<Skill> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const { data } = await apiClient.post<Skill>(
    `/skills/${id}/convert/upload`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Quality gates
// ---------------------------------------------------------------------------

export async function checkStructure(
  id: string,
): Promise<StructureCheckResult> {
  const { data } = await apiClient.post<StructureCheckResult>(
    `/skills/${id}/check-structure`,
  );
  return data;
}

export async function evaluateQuality(
  id: string,
): Promise<QualityEvaluation> {
  const { data } = await apiClient.post<QualityEvaluation>(
    `/skills/${id}/evaluate-quality`,
  );
  return data;
}

export async function getEvaluation(id: string): Promise<QualityEvaluation> {
  const { data } = await apiClient.get<QualityEvaluation>(
    `/skills/${id}/evaluation`,
  );
  return data;
}

// ---------------------------------------------------------------------------
// SOP regeneration
// ---------------------------------------------------------------------------

export async function regenerateSop(
  id: string,
  feedback: string,
): Promise<Skill> {
  const { data } = await apiClient.post<Skill>(
    `/skills/${id}/regenerate-sop`,
    { feedback },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export async function uploadResources(
  id: string,
  files: File[],
  resourceType: ResourceType,
): Promise<SkillResource[]> {
  const results: SkillResource[] = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post<SkillResource>(
      `/skills/${id}/resources`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        params: { resource_type: resourceType },
      },
    );
    results.push(data);
  }
  return results;
}

export async function deleteResource(
  skillId: string,
  resourceId: string,
): Promise<void> {
  await apiClient.delete(`/skills/${skillId}/resources/${resourceId}`);
}

export async function downloadResource(
  skillId: string,
  resourceId: string,
  filename: string,
): Promise<void> {
  const { data } = await apiClient.get<Blob>(
    `/skills/${skillId}/resources/${resourceId}/download`,
    { responseType: "blob" },
  );
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

export async function exportSkillZip(id: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/skills/${id}/export`, {
    responseType: "blob",
  });
  return data;
}

export async function importSkillZip(file: File): Promise<Skill> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<Skill>("/skills/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
