import apiClient from "@/api/client";
import type { MetaSkillResource } from "@/types/meta-skill";

export async function getMetaSkillResources(
  skillType: string,
): Promise<MetaSkillResource[]> {
  const { data } = await apiClient.get<MetaSkillResource[]>(
    `/meta-skills/${skillType}/resources`,
  );
  return data;
}

export async function fetchMetaSkillResourceContent(
  skillType: string,
  resourceType: string,
  filename: string,
): Promise<string> {
  const { data } = await apiClient.get<string>(
    `/meta-skills/${skillType}/resources/${resourceType}/${filename}`,
    { responseType: "text" },
  );
  return data;
}

export async function downloadMetaSkillResource(
  skillType: string,
  resourceType: string,
  filename: string,
): Promise<void> {
  const { data } = await apiClient.get(
    `/meta-skills/${skillType}/resources/${resourceType}/${filename}`,
    { responseType: "blob" },
  );
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
