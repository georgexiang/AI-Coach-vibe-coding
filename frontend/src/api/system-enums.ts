import apiClient from "./client";
import type {
  SystemEnum,
  SystemEnumCreate,
  SystemEnumUpdate,
} from "@/types/system-enum";

export async function getSystemEnums(
  category: string,
  activeOnly: boolean = true,
): Promise<SystemEnum[]> {
  const { data } = await apiClient.get<SystemEnum[]>("/system-enums", {
    params: { category, active_only: activeOnly },
  });
  return data;
}

export async function getSystemEnumCategories(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>("/system-enums/categories");
  return data;
}

export async function createSystemEnum(
  payload: SystemEnumCreate,
): Promise<SystemEnum> {
  const { data } = await apiClient.post<SystemEnum>("/system-enums", payload);
  return data;
}

export async function updateSystemEnum(
  id: string,
  payload: SystemEnumUpdate,
): Promise<SystemEnum> {
  const { data } = await apiClient.put<SystemEnum>(
    `/system-enums/${id}`,
    payload,
  );
  return data;
}

export async function deleteSystemEnum(id: string): Promise<void> {
  await apiClient.delete(`/system-enums/${id}`);
}
