import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  VoiceLiveInstance,
  VoiceLiveInstanceListResponse,
} from "@/types/voice-live";

vi.mock("@/api/voice-live", () => ({
  fetchVoiceLiveInstances: vi.fn(),
  fetchVoiceLiveInstance: vi.fn(),
  createVoiceLiveInstance: vi.fn(),
  updateVoiceLiveInstance: vi.fn(),
  deleteVoiceLiveInstance: vi.fn(),
  assignVoiceLiveInstance: vi.fn(),
  unassignVoiceLiveInstance: vi.fn(),
}));

import {
  fetchVoiceLiveInstances,
  fetchVoiceLiveInstance,
  createVoiceLiveInstance,
  updateVoiceLiveInstance,
  deleteVoiceLiveInstance,
  assignVoiceLiveInstance,
  unassignVoiceLiveInstance,
} from "@/api/voice-live";
import {
  useVoiceLiveInstances,
  useVoiceLiveInstance,
  useCreateVoiceLiveInstance,
  useUpdateVoiceLiveInstance,
  useDeleteVoiceLiveInstance,
  useAssignVoiceLiveInstance,
  useUnassignVoiceLiveInstance,
} from "./use-voice-live-instances";

const mockedFetchInstances = vi.mocked(fetchVoiceLiveInstances);
const mockedFetchInstance = vi.mocked(fetchVoiceLiveInstance);
const mockedCreateInstance = vi.mocked(createVoiceLiveInstance);
const mockedUpdateInstance = vi.mocked(updateVoiceLiveInstance);
const mockedDeleteInstance = vi.mocked(deleteVoiceLiveInstance);
const mockedAssignInstance = vi.mocked(assignVoiceLiveInstance);
const mockedUnassignInstance = vi.mocked(unassignVoiceLiveInstance);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

const mockInstance: VoiceLiveInstance = {
  id: "vl1",
  name: "Test VL Instance",
  description: "A test instance",
  voice_live_model: "gpt-4o-realtime-preview",
  enabled: true,
  voice_name: "zh-CN-XiaoxiaoMultilingualNeural",
  voice_type: "neural",
  voice_temperature: 0.7,
  voice_custom: false,
  avatar_character: "lisa",
  avatar_style: "casual-sitting",
  avatar_customized: false,
  turn_detection_type: "server_vad",
  noise_suppression: true,
  echo_cancellation: true,
  eou_detection: true,
  recognition_language: "zh-CN",
  response_temperature: 0.8,
  proactive_engagement: false,
  auto_detect_language: false,
  playback_speed: 1.0,
  custom_lexicon_enabled: false,
  custom_lexicon_url: "",
  avatar_enabled: true,
  model_instruction: "",
  hcp_count: 2,
  created_by: "admin",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockListResponse: VoiceLiveInstanceListResponse = {
  items: [mockInstance],
  total: 1,
};

describe("useVoiceLiveInstances", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches instances without params", async () => {
    mockedFetchInstances.mockResolvedValueOnce(mockListResponse);

    const { result } = renderHook(() => useVoiceLiveInstances(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedFetchInstances).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(mockListResponse);
  });

  it("fetches instances with params", async () => {
    mockedFetchInstances.mockResolvedValueOnce(mockListResponse);

    const params = { page: 2, page_size: 10 };
    const { result } = renderHook(() => useVoiceLiveInstances(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedFetchInstances).toHaveBeenCalledWith(params);
  });

  it("returns error state when fetch fails", async () => {
    mockedFetchInstances.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useVoiceLiveInstances(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useVoiceLiveInstance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches a single instance by id", async () => {
    mockedFetchInstance.mockResolvedValueOnce(mockInstance);

    const { result } = renderHook(() => useVoiceLiveInstance("vl1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedFetchInstance).toHaveBeenCalledWith("vl1");
    expect(result.current.data).toEqual(mockInstance);
  });

  it("does not fetch when id is undefined", () => {
    const { result } = renderHook(() => useVoiceLiveInstance(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockedFetchInstance).not.toHaveBeenCalled();
  });
});

describe("useCreateVoiceLiveInstance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an instance", async () => {
    mockedCreateInstance.mockResolvedValueOnce(mockInstance);

    const { result } = renderHook(() => useCreateVoiceLiveInstance(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Test VL Instance" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedCreateInstance).toHaveBeenCalledWith({
      name: "Test VL Instance",
    });
  });

  it("invalidates voice-live-instances queries on success", async () => {
    mockedCreateInstance.mockResolvedValueOnce(mockInstance);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    }

    const { result } = renderHook(() => useCreateVoiceLiveInstance(), {
      wrapper: Wrapper,
    });

    result.current.mutate({ name: "New" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["voice-live-instances"],
    });
  });
});

describe("useUpdateVoiceLiveInstance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates an instance", async () => {
    const updated = { ...mockInstance, name: "Updated Name" };
    mockedUpdateInstance.mockResolvedValueOnce(updated);

    const { result } = renderHook(() => useUpdateVoiceLiveInstance(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "vl1", data: { name: "Updated Name" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedUpdateInstance).toHaveBeenCalledWith("vl1", {
      name: "Updated Name",
    });
  });

  it("invalidates voice-live-instances queries on success", async () => {
    mockedUpdateInstance.mockResolvedValueOnce(mockInstance);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    }

    const { result } = renderHook(() => useUpdateVoiceLiveInstance(), {
      wrapper: Wrapper,
    });

    result.current.mutate({ id: "vl1", data: { enabled: false } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["voice-live-instances"],
    });
  });
});

describe("useDeleteVoiceLiveInstance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an instance by id", async () => {
    mockedDeleteInstance.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteVoiceLiveInstance(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("vl1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDeleteInstance).toHaveBeenCalledWith("vl1");
  });

  it("invalidates voice-live-instances queries on success", async () => {
    mockedDeleteInstance.mockResolvedValueOnce(undefined);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    }

    const { result } = renderHook(() => useDeleteVoiceLiveInstance(), {
      wrapper: Wrapper,
    });

    result.current.mutate("vl1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["voice-live-instances"],
    });
  });
});

describe("useAssignVoiceLiveInstance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assigns an instance to an HCP profile", async () => {
    mockedAssignInstance.mockResolvedValueOnce(mockInstance);

    const { result } = renderHook(() => useAssignVoiceLiveInstance(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      instanceId: "vl1",
      hcpProfileId: "hcp1",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedAssignInstance).toHaveBeenCalledWith("vl1", "hcp1");
  });

  it("invalidates both voice-live-instances and hcp-profiles queries on success", async () => {
    mockedAssignInstance.mockResolvedValueOnce(mockInstance);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    }

    const { result } = renderHook(() => useAssignVoiceLiveInstance(), {
      wrapper: Wrapper,
    });

    result.current.mutate({
      instanceId: "vl1",
      hcpProfileId: "hcp1",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["voice-live-instances"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["hcp-profiles"],
    });
  });
});

describe("useUnassignVoiceLiveInstance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("unassigns a VL instance from an HCP profile", async () => {
    mockedUnassignInstance.mockResolvedValueOnce({
      hcp_profile_id: "hcp1",
      voice_live_instance_id: null,
    });

    const { result } = renderHook(() => useUnassignVoiceLiveInstance(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("hcp1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedUnassignInstance).toHaveBeenCalledWith("hcp1");
  });

  it("invalidates both voice-live-instances and hcp-profiles queries on success", async () => {
    mockedUnassignInstance.mockResolvedValueOnce({
      hcp_profile_id: "hcp1",
      voice_live_instance_id: null,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    }

    const { result } = renderHook(() => useUnassignVoiceLiveInstance(), {
      wrapper: Wrapper,
    });

    result.current.mutate("hcp1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["voice-live-instances"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["hcp-profiles"],
    });
  });
});
