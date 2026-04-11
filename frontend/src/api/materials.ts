import apiClient from "./client";
import type {
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

/**
 * Download a material version file.
 * @param mode - "inline" opens in browser (PDF preview), "attachment" triggers download.
 */
export async function downloadVersion(
  materialId: string,
  versionId: string,
  filename: string,
  mode: "inline" | "attachment" = "attachment",
): Promise<void> {
  const { data } = await apiClient.get<Blob>(
    `/materials/${materialId}/versions/${versionId}/download`,
    { params: { mode }, responseType: "blob" },
  );
  const url = URL.createObjectURL(data);

  if (mode === "inline") {
    window.open(url, "_blank");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Revoke after a short delay so the browser can finish loading
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
