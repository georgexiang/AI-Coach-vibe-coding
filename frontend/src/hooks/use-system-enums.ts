import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSystemEnums,
  createSystemEnum,
  updateSystemEnum,
  deleteSystemEnum,
} from "@/api/system-enums";
import type { SystemEnumCreate, SystemEnumUpdate } from "@/types/system-enum";

export function useSystemEnums(category?: string) {
  return useQuery({
    queryKey: ["system-enums", category],
    queryFn: () => getSystemEnums({ category, active_only: true }),
  });
}

export function useAllSystemEnums() {
  return useQuery({
    queryKey: ["system-enums", "all"],
    queryFn: () => getSystemEnums({ active_only: false }),
  });
}

export function useCreateSystemEnum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SystemEnumCreate) => createSystemEnum(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-enums"] });
    },
  });
}

export function useUpdateSystemEnum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SystemEnumUpdate }) =>
      updateSystemEnum(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-enums"] });
    },
  });
}

export function useDeleteSystemEnum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSystemEnum(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-enums"] });
    },
  });
}
