import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

vi.mock("@/api/scoring", () => ({
  triggerScoring: vi.fn(),
  getSessionScore: vi.fn(),
}));

import { triggerScoring, getSessionScore } from "@/api/scoring";
import { useSessionScore, useTriggerScoring } from "@/hooks/use-scoring";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const mockScore = {
  session_id: "sess1",
  overall_score: 85,
  passed: true,
  feedback_summary: "Good job",
  details: [],
};

describe("useSessionScore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch session score by id", async () => {
    vi.mocked(getSessionScore).mockResolvedValueOnce(mockScore);

    const { result } = renderHook(() => useSessionScore("sess1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getSessionScore).toHaveBeenCalledWith("sess1");
    expect(result.current.data).toEqual(mockScore);
  });

  it("should not fetch when sessionId is undefined", () => {
    const { result } = renderHook(() => useSessionScore(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getSessionScore).not.toHaveBeenCalled();
  });

  it("should handle fetch error", async () => {
    vi.mocked(getSessionScore).mockRejectedValueOnce(new Error("404"));

    const { result } = renderHook(() => useSessionScore("bad-id"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useTriggerScoring", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should trigger scoring for a session", async () => {
    vi.mocked(triggerScoring).mockResolvedValueOnce(mockScore);

    const { result } = renderHook(() => useTriggerScoring(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("sess1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(triggerScoring).toHaveBeenCalledWith("sess1");
  });

  it("should handle scoring failure", async () => {
    vi.mocked(triggerScoring).mockRejectedValueOnce(new Error("500"));

    const { result } = renderHook(() => useTriggerScoring(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("sess1");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
