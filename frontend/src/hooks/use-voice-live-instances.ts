import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignVoiceLiveInstance,
  createVoiceLiveInstance,
  deleteVoiceLiveInstance,
  fetchVoiceLiveInstance,
  fetchVoiceLiveInstances,
  unassignVoiceLiveInstance,
  updateVoiceLiveInstance,
} from "@/api/voice-live";
import type {
  VoiceLiveInstanceCreate,
  VoiceLiveInstanceUpdate,
} from "@/types/voice-live";

const QUERY_KEY = "voice-live-instances";

export function useVoiceLiveInstances(params?: {
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => fetchVoiceLiveInstances(params),
  });
}

export function useVoiceLiveInstance(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => fetchVoiceLiveInstance(id!),
    enabled: !!id,
  });
}

export function useCreateVoiceLiveInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: VoiceLiveInstanceCreate) =>
      createVoiceLiveInstance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useUpdateVoiceLiveInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VoiceLiveInstanceUpdate }) =>
      updateVoiceLiveInstance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeleteVoiceLiveInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVoiceLiveInstance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useAssignVoiceLiveInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instanceId,
      hcpProfileId,
    }: {
      instanceId: string;
      hcpProfileId: string;
    }) => assignVoiceLiveInstance(instanceId, hcpProfileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}

export function useUnassignVoiceLiveInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hcpProfileId: string) => unassignVoiceLiveInstance(hcpProfileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}
