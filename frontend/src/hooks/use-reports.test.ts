import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";

vi.mock("@/api/reports", () => ({
  getSessionReport: vi.fn(),
  getSessionSuggestions: vi.fn(),
}));

import { getSessionReport, getSessionSuggestions } from "@/api/reports";
import { useSessionReport, useSessionSuggestions } from "@/hooks/use-reports";

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

const mockReport = {
  session_id: "sess-1",
  scenario_name: "Test Scenario",
  product: "Drug A",
  hcp_name: "Dr. Smith",
  overall_score: 85,
  passed: true,
  feedback_summary: "Good job",
  duration_seconds: 300,
  completed_at: "2026-03-20T10:00:00Z",
  dimensions: [],
  strengths: [],
  weaknesses: [],
  improvements: [],
  key_messages_delivered: 3,
  key_messages_total: 5,
};

const mockSuggestions = [
  { id: "s1", dimension: "Knowledge", suggestion: "Study more", priority: "high" as const },
  { id: "s2", dimension: "Communication", suggestion: "Be clearer", priority: "medium" as const },
];

describe("useSessionReport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch session report by id", async () => {
    vi.mocked(getSessionReport).mockResolvedValueOnce(mockReport);

    const { result } = renderHook(() => useSessionReport("sess-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getSessionReport).toHaveBeenCalledWith("sess-1");
    expect(result.current.data).toEqual(mockReport);
  });

  it("should not fetch when sessionId is undefined", () => {
    const { result } = renderHook(() => useSessionReport(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getSessionReport).not.toHaveBeenCalled();
  });

  it("should handle fetch error", async () => {
    vi.mocked(getSessionReport).mockRejectedValueOnce(new Error("404"));

    const { result } = renderHook(() => useSessionReport("bad-id"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useSessionSuggestions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch session suggestions by id", async () => {
    vi.mocked(getSessionSuggestions).mockResolvedValueOnce(mockSuggestions);

    const { result } = renderHook(() => useSessionSuggestions("sess-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getSessionSuggestions).toHaveBeenCalledWith("sess-1");
    expect(result.current.data).toEqual(mockSuggestions);
  });

  it("should not fetch when sessionId is undefined", () => {
    const { result } = renderHook(() => useSessionSuggestions(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getSessionSuggestions).not.toHaveBeenCalled();
  });

  it("should handle fetch error", async () => {
    vi.mocked(getSessionSuggestions).mockRejectedValueOnce(new Error("500"));

    const { result } = renderHook(() => useSessionSuggestions("bad-id"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
