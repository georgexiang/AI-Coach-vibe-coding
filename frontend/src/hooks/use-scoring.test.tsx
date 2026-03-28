import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import type { ScoreHistoryItem } from "@/types/report";

vi.mock("@/api/scoring", () => ({
  triggerScoring: vi.fn(),
  getSessionScore: vi.fn(),
  getScoreHistory: vi.fn(),
}));

import { triggerScoring, getSessionScore, getScoreHistory } from "@/api/scoring";
import {
  useSessionScore,
  useTriggerScoring,
  useScoreHistory,
} from "@/hooks/use-scoring";

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

  it("should invalidate scoring and sessions queries on success", async () => {
    vi.mocked(triggerScoring).mockResolvedValueOnce(mockScore);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    }

    const { result } = renderHook(() => useTriggerScoring(), {
      wrapper: Wrapper,
    });

    result.current.mutate("sess1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["scoring", "sess1"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["sessions", "sess1"],
    });
  });
});

describe("useScoreHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch score history without limit", async () => {
    const mockHistory: ScoreHistoryItem[] = [
      {
        session_id: "sess1",
        scenario_name: "Test",
        overall_score: 85,
        passed: true,
        completed_at: "2024-01-01",
        dimensions: [],
      },
    ];
    vi.mocked(getScoreHistory).mockResolvedValueOnce(mockHistory);

    const { result } = renderHook(() => useScoreHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getScoreHistory).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(mockHistory);
  });

  it("should fetch score history with limit", async () => {
    const mockHistory: ScoreHistoryItem[] = [
      {
        session_id: "sess1",
        scenario_name: "Test",
        overall_score: 90,
        passed: true,
        completed_at: "2024-01-01",
        dimensions: [],
      },
    ];
    vi.mocked(getScoreHistory).mockResolvedValueOnce(mockHistory);

    const { result } = renderHook(() => useScoreHistory(5), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getScoreHistory).toHaveBeenCalledWith(5);
    expect(result.current.data).toEqual(mockHistory);
  });

  it("should handle score history fetch error", async () => {
    vi.mocked(getScoreHistory).mockRejectedValueOnce(
      new Error("Failed to fetch"),
    );

    const { result } = renderHook(() => useScoreHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("should have correct query key with limit", async () => {
    vi.mocked(getScoreHistory).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useScoreHistory(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getScoreHistory).toHaveBeenCalledWith(10);
  });
});
