import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useCombinedScore } from "./use-combined-score";
import apiClient from "@/api/client";

vi.mock("@/api/client", () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockReport = {
  session_id: "sess-1",
  overall_score: 75,
  overall_combined_score: 72,
  passed: true,
  content_dimensions: [],
  voice_dimensions: [],
  voice_summary: {
    overall_voice_score: 68,
    voice_score_status: "completed",
    dimensions: [
      { id: "d1", dimension: "clarity", score: 70, weight: 0.3, strengths: "", weaknesses: "", suggestions: "", category: "voice", created_at: "" },
    ],
  },
  strengths: ["Good pace"],
  weaknesses: ["Low volume"],
  suggestions: ["Speak louder"],
  feedback_summary: "Overall good",
  audio_url: "https://blob.example.com/audio.webm",
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useCombinedScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when sessionId is undefined", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCombinedScore(undefined), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("fetches combined report when sessionId is provided", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockReport });
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCombinedScore("sess-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/scoring/sessions/sess-1/combined-report");
    expect(result.current.data).toEqual(mockReport);
  });

  it("returns error state on API failure", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("Network error"));
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCombinedScore("sess-1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it("uses correct query key", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockReport });
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCombinedScore("sess-2"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/scoring/sessions/sess-2/combined-report");
  });
});
