import apiClient from "./client";
import type {
  MaterialChunk,
  MaterialUpdate,
  MaterialVersion,
  PaginatedMaterials,
  TrainingMaterial,
} from "@/types/material";

export async function getMaterials(params?: {
  page?: number;
  page_size?: number;
  product?: string;
  search?: string;
  include_archived?: boolean;
}): Promise<PaginatedMaterials> {
  const { data } = await apiClient.get<PaginatedMaterials>("/materials", {
    params,
  });
  return data;
}

export async function getMaterial(id: string): Promise<TrainingMaterial> {
  const { data } = await apiClient.get<TrainingMaterial>(`/materials/${id}`);
  return data;
}

export async function uploadMaterial(
  file: File,
  product: string,
  name: string,
  therapeuticArea?: string,
  tags?: string,
  materialId?: string,
  onProgress?: (percent: number) => void,
): Promise<TrainingMaterial> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("product", product);
  formData.append("name", name);
  if (therapeuticArea) formData.append("therapeutic_area", therapeuticArea);
  if (tags) formData.append("tags", tags);
  if (materialId) formData.append("material_id", materialId);

  const { data } = await apiClient.post<TrainingMaterial>(
    "/materials",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    },
  );
  return data;
}

export async function updateMaterial(
  id: string,
  update: MaterialUpdate,
): Promise<TrainingMaterial> {
  const { data } = await apiClient.put<TrainingMaterial>(
    `/materials/${id}`,
    update,
  );
  return data;
}

export async function archiveMaterial(id: string): Promise<void> {
  await apiClient.delete(`/materials/${id}`);
}

export async function restoreMaterial(id: string): Promise<TrainingMaterial> {
  const { data } = await apiClient.post<TrainingMaterial>(
    `/materials/${id}/restore`,
  );
  return data;
}

export async function getMaterialVersions(
  id: string,
): Promise<MaterialVersion[]> {
  const { data } = await apiClient.get<MaterialVersion[]>(
    `/materials/${id}/versions`,
  );
  return data;
}

export async function getVersionChunks(
  materialId: string,
  versionId: string,
): Promise<MaterialChunk[]> {
  const { data } = await apiClient.get<MaterialChunk[]>(
    `/materials/${materialId}/versions/${versionId}/chunks`,
  );
  return data;
}

export async function searchChunks(
  product: string,
  query: string,
  limit?: number,
): Promise<MaterialChunk[]> {
  const { data } = await apiClient.get<MaterialChunk[]>("/materials/search", {
    params: { product, query, limit },
  });
  return data;
}
