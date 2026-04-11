import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveMaterial,
  getMaterial,
  getMaterialVersions,
  getMaterials,
  restoreMaterial,
  updateMaterial,
  uploadMaterial,
} from "@/api/materials";
import type { MaterialUpdate } from "@/types/material";

export function useMaterials(params?: {
  page?: number;
  page_size?: number;
  product?: string;
  search?: string;
  include_archived?: boolean;
}) {
  return useQuery({
    queryKey: ["materials", params],
    queryFn: () => getMaterials(params),
  });
}

export function useMaterial(id: string | undefined) {
  return useQuery({
    queryKey: ["materials", id],
    queryFn: () => getMaterial(id!),
    enabled: !!id,
  });
}

export function useMaterialVersions(id: string | undefined) {
  return useQuery({
    queryKey: ["materials", id, "versions"],
    queryFn: () => getMaterialVersions(id!),
    enabled: !!id,
  });
}

export function useUploadMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      file: File;
      product: string;
      name: string;
      therapeuticArea?: string;
      tags?: string;
      materialId?: string;
      onProgress?: (percent: number) => void;
    }) =>
      uploadMaterial(
        args.file,
        args.product,
        args.name,
        args.therapeuticArea,
        args.tags,
        args.materialId,
        args.onProgress,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useUpdateMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; data: MaterialUpdate }) =>
      updateMaterial(args.id, args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useArchiveMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useRestoreMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}
