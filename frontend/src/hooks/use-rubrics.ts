import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRubrics,
  createRubric,
  updateRubric,
  deleteRubric,
} from "@/api/rubrics";
import type { RubricCreate, RubricUpdate } from "@/types/rubric";

export function useRubrics(params?: { scenario_type?: string }) {
  return useQuery({
    queryKey: ["rubrics", params],
    queryFn: () => getRubrics(params),
  });
}

export function useCreateRubric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RubricCreate) => createRubric(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
    },
  });
}

export function useUpdateRubric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RubricUpdate }) =>
      updateRubric(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
    },
  });
}

export function useDeleteRubric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRubric(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
    },
  });
}
