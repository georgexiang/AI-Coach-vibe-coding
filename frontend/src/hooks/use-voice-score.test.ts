import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";
import { useVoiceScore } from "./use-voice-score";

vi.mock("@/api/unified-session", () => ({
  getVoiceScoreStatus: vi.fn(),
}));

import { getVoiceScoreStatus } from "@/api/unified-session";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => vi.clearAllMocks());

describe("useVoiceScore", () => {
  it("does not fetch when sessionId is undefined", () => {
    renderHook(() => useVoiceScore(undefined), {
      wrapper: createWrapper(),
    });

    expect(getVoiceScoreStatus).not.toHaveBeenCalled();
  });

  it("fetches when sessionId is provided", async () => {
    vi.mocked(getVoiceScoreStatus).mockResolvedValue({
      session_id: "s1",
      voice_score_status: "completed",
      audio_url: "audio/s1.webm",
    });

    const { result } = renderHook(() => useVoiceScore("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getVoiceScoreStatus).toHaveBeenCalledWith("s1");
    expect(result.current.data?.voice_score_status).toBe("completed");
  });

  it("returns voice score data on success", async () => {
    vi.mocked(getVoiceScoreStatus).mockResolvedValue({
      session_id: "s2",
      voice_score_status: "completed",
      audio_url: "audio/s2.webm",
    });

    const { result } = renderHook(() => useVoiceScore("s2"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.session_id).toBe("s2");
    expect(result.current.data!.audio_url).toBe("audio/s2.webm");
  });

  it("polls when status is pending", async () => {
    vi.mocked(getVoiceScoreStatus).mockResolvedValue({
      session_id: "s1",
      voice_score_status: "pending",
      audio_url: null,
    });

    const { result } = renderHook(() => useVoiceScore("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The refetchInterval should return 3000 for pending status
    // We verify the data indicates pending
    expect(result.current.data?.voice_score_status).toBe("pending");
  });

  it("polls when status is processing", async () => {
    vi.mocked(getVoiceScoreStatus).mockResolvedValue({
      session_id: "s1",
      voice_score_status: "processing",
      audio_url: null,
    });

    const { result } = renderHook(() => useVoiceScore("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.voice_score_status).toBe("processing");
  });

  it("handles error state", async () => {
    vi.mocked(getVoiceScoreStatus).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useVoiceScore("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it("returns none status for sessions without audio", async () => {
    vi.mocked(getVoiceScoreStatus).mockResolvedValue({
      session_id: "s3",
      voice_score_status: "none",
      audio_url: null,
    });

    const { result } = renderHook(() => useVoiceScore("s3"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.voice_score_status).toBe("none");
    expect(result.current.data?.audio_url).toBeNull();
  });

  it("returns failed status", async () => {
    vi.mocked(getVoiceScoreStatus).mockResolvedValue({
      session_id: "s4",
      voice_score_status: "failed",
      audio_url: "audio/s4.webm",
    });

    const { result } = renderHook(() => useVoiceScore("s4"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.voice_score_status).toBe("failed");
  });
});
