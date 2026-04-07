import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/hcp-profiles", () => ({
  batchSyncAgents: vi.fn(),
}));

import { batchSyncAgents } from "@/api/hcp-profiles";
import { useBatchResyncAgents } from "./use-voice-live-management";

const mockedBatchSyncAgents = vi.mocked(batchSyncAgents);

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

describe("useBatchResyncAgents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls batchSyncAgents on mutate", async () => {
    const mockResult = { synced: 5, failed: 0, total: 5 };
    mockedBatchSyncAgents.mockResolvedValueOnce(mockResult);

    const { result } = renderHook(() => useBatchResyncAgents(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedBatchSyncAgents).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockResult);
  });

  it("invalidates hcp-profiles queries on success", async () => {
    mockedBatchSyncAgents.mockResolvedValueOnce({
      synced: 3,
      failed: 1,
      total: 4,
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

    const { result } = renderHook(() => useBatchResyncAgents(), {
      wrapper: Wrapper,
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["hcp-profiles"],
    });
  });

  it("sets error state when mutation fails", async () => {
    mockedBatchSyncAgents.mockRejectedValueOnce(new Error("Sync failed"));

    const { result } = renderHook(() => useBatchResyncAgents(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });

  it("supports mutateAsync for promise-based usage", async () => {
    const mockResult = { synced: 2, failed: 0, total: 2 };
    mockedBatchSyncAgents.mockResolvedValueOnce(mockResult);

    const { result } = renderHook(() => useBatchResyncAgents(), {
      wrapper: createWrapper(),
    });

    const response = await result.current.mutateAsync();

    expect(response).toEqual(mockResult);
    expect(mockedBatchSyncAgents).toHaveBeenCalledTimes(1);
  });
});
