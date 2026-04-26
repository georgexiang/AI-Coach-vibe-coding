import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDryRun, cancelDryRun, getDryRun, getDryRuns, getDryRunStatus } from "@/api/dry-runs";
import { skillKeys } from "./use-skills";

// Query-key factory extending skillKeys pattern
export const dryRunKeys = {
  all: (skillId: string) => [...skillKeys.detail(skillId), "dry-runs"] as const,
  list: (skillId: string, params?: Record<string, unknown>) => [...dryRunKeys.all(skillId), "list", params] as const,
  detail: (skillId: string, runId: string) => [...dryRunKeys.all(skillId), runId] as const,
  status: (skillId: string, runId: string) => [...dryRunKeys.detail(skillId, runId), "status"] as const,
};

export function useDryRuns(skillId: string | undefined, params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: dryRunKeys.list(skillId ?? "", params),
    queryFn: () => getDryRuns(skillId!, params),
    enabled: !!skillId,
  });
}

export function useDryRun(skillId: string | undefined, runId: string | undefined) {
  return useQuery({
    queryKey: dryRunKeys.detail(skillId ?? "", runId ?? ""),
    queryFn: () => getDryRun(skillId!, runId!),
    enabled: !!skillId && !!runId,
  });
}

export function useDryRunStatus(skillId: string, runId: string, enabled: boolean) {
  return useQuery({
    queryKey: dryRunKeys.status(skillId, runId),
    queryFn: () => getDryRunStatus(skillId, runId),
    enabled,
    refetchInterval: enabled ? 3000 : false,  // Poll every 3s per UI-SPEC
  });
}

export function useCreateDryRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillId: string) => createDryRun(skillId),
    onSuccess: (_data, skillId) => {
      queryClient.invalidateQueries({ queryKey: dryRunKeys.all(skillId) });
    },
  });
}

export function useCancelDryRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { skillId: string; runId: string }) => cancelDryRun(args.skillId, args.runId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: dryRunKeys.all(variables.skillId) });
    },
  });
}
