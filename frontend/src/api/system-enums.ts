import apiClient from "./client";
import type { SystemEnum, SystemEnumCreate, SystemEnumUpdate } from "@/types/system-enum";

export async function getSystemEnums(params?: { category?: string; active_only?: boolean }) {
  const { data } = await apiClient.get<SystemEnum[]>("/system-enums", { params });
  return data;
}

export async function createSystemEnum(payload: SystemEnumCreate) {
  const { data } = await apiClient.post<SystemEnum>("/system-enums", payload);
  return data;
}

export async function updateSystemEnum(id: string, payload: SystemEnumUpdate) {
  const { data } = await apiClient.put<SystemEnum>(`/system-enums/${id}`, payload);
  return data;
}

export async function deleteSystemEnum(id: string) {
  await apiClient.delete(`/system-enums/${id}`);
}
