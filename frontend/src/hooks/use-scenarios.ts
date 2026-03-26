import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getScenarios,
  getActiveScenarios,
  getScenario,
  createScenario,
  updateScenario,
  deleteScenario,
  cloneScenario,
} from "@/api/scenarios";
import type { ScenarioCreate, ScenarioUpdate } from "@/types/scenario";

export function useScenarios(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  mode?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["scenarios", params],
    queryFn: () => getScenarios(params),
  });
}

export function useActiveScenarios(params?: {
  mode?: string;
}) {
  return useQuery({
    queryKey: ["scenarios", "active", params],
    queryFn: () => getActiveScenarios(params),
  });
}

export function useScenario(id: string | undefined) {
  return useQuery({
    queryKey: ["scenarios", id],
    queryFn: () => getScenario(id!),
    enabled: !!id,
  });
}

export function useCreateScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ScenarioCreate) => createScenario(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
    },
  });
}

export function useUpdateScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScenarioUpdate }) =>
      updateScenario(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
    },
  });
}

export function useDeleteScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScenario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
    },
  });
}

export function useCloneScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cloneScenario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
    },
  });
}
