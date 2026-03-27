import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";

vi.mock("@/api/voice-live", () => ({
  fetchVoiceLiveToken: vi.fn(),
  fetchVoiceLiveStatus: vi.fn(),
}));

import { fetchVoiceLiveToken, fetchVoiceLiveStatus } from "@/api/voice-live";
import { useVoiceToken, useVoiceLiveStatus } from "@/hooks/use-voice-token";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useVoiceToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns idle initially and calls fetchVoiceLiveToken on mutate", async () => {
    const tokenData = {
      endpoint: "wss://eastus2.api.cognitive.microsoft.com",
      token: "test-token-123",
      region: "eastus2",
      model: "gpt-4o-realtime",
      avatar_enabled: true,
      avatar_character: "lisa",
      voice_name: "en-US-JennyNeural",
    };
    vi.mocked(fetchVoiceLiveToken).mockResolvedValueOnce(tokenData);

    const { result } = renderHook(() => useVoiceToken(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isIdle).toBe(true);

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchVoiceLiveToken).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual(tokenData);
  });

  it("surfaces errors from fetchVoiceLiveToken", async () => {
    vi.mocked(fetchVoiceLiveToken).mockRejectedValueOnce(
      new Error("401 Unauthorized"),
    );

    const { result } = renderHook(() => useVoiceToken(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("401 Unauthorized");
  });
});

describe("useVoiceLiveStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls fetchVoiceLiveStatus and returns status data", async () => {
    const statusData = {
      voice_live_available: true,
      avatar_available: false,
      voice_name: "en-US-JennyNeural",
      avatar_character: "lisa",
    };
    vi.mocked(fetchVoiceLiveStatus).mockResolvedValueOnce(statusData);

    const { result } = renderHook(() => useVoiceLiveStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchVoiceLiveStatus).toHaveBeenCalledOnce();
    expect(result.current.data?.voice_live_available).toBe(true);
    expect(result.current.data?.avatar_available).toBe(false);
  });

  it("handles error state when fetchVoiceLiveStatus rejects", async () => {
    // The hook specifies retry: 1, so it will retry once before erroring
    vi.mocked(fetchVoiceLiveStatus).mockRejectedValue(
      new Error("Network Error"),
    );

    const { result } = renderHook(() => useVoiceLiveStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 5000,
    });
    expect(result.current.error?.message).toBe("Network Error");
  });

  it("uses queryKey ['voice-live', 'status']", async () => {
    const statusData = {
      voice_live_available: true,
      avatar_available: true,
      voice_name: "zh-CN-XiaoxiaoNeural",
      avatar_character: "lisa",
    };
    vi.mocked(fetchVoiceLiveStatus).mockResolvedValueOnce(statusData);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    const wrapper = function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    };

    const { result } = renderHook(() => useVoiceLiveStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cachedData = queryClient.getQueryData(["voice-live", "status"]);
    expect(cachedData).toEqual(statusData);
  });
});
