import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RegionCapabilities } from "@/types/azure-config";

vi.mock("@/api/azure-config", () => ({
  getRegionCapabilities: vi.fn(),
}));

import { getRegionCapabilities } from "@/api/azure-config";
import { useRegionCapabilities } from "./use-region-capabilities";

const mockedGetRegionCapabilities = vi.mocked(getRegionCapabilities);

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

const mockCapabilities: RegionCapabilities = {
  region: "eastus",
  services: {
    azure_openai: { available: true, note: "Available" },
    azure_speech_tts: { available: true, note: "Available" },
    azure_avatar: { available: false, note: "Not available in this region" },
  },
};

describe("useRegionCapabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches region capabilities when region is provided", async () => {
    mockedGetRegionCapabilities.mockResolvedValueOnce(mockCapabilities);

    const { result } = renderHook(() => useRegionCapabilities("eastus"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockCapabilities);
    expect(mockedGetRegionCapabilities).toHaveBeenCalledWith("eastus");
  });

  it("does not fetch when region is undefined", () => {
    const { result } = renderHook(() => useRegionCapabilities(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockedGetRegionCapabilities).not.toHaveBeenCalled();
  });

  it("does not fetch when region is empty string", () => {
    const { result } = renderHook(() => useRegionCapabilities(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockedGetRegionCapabilities).not.toHaveBeenCalled();
  });

  it("does not fetch when region is whitespace only", () => {
    const { result } = renderHook(() => useRegionCapabilities("   "), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockedGetRegionCapabilities).not.toHaveBeenCalled();
  });

  it("returns error state when fetch fails", async () => {
    // The hook has retry: 1, so it will retry once after the first failure.
    // We need to reject both the initial call and the retry.
    mockedGetRegionCapabilities
      .mockRejectedValueOnce(new Error("Region not found"))
      .mockRejectedValueOnce(new Error("Region not found"));

    const { result } = renderHook(() => useRegionCapabilities("badregion"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 5000,
    });
    expect(result.current.error).toBeTruthy();
  });

  it("returns loading state initially when region is valid", () => {
    mockedGetRegionCapabilities.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRegionCapabilities("westus"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("uses correct query key with region", async () => {
    mockedGetRegionCapabilities.mockResolvedValueOnce(mockCapabilities);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    }

    const { result } = renderHook(() => useRegionCapabilities("eastus"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cachedData = queryClient.getQueryData([
      "azure-config",
      "region-capabilities",
      "eastus",
    ]);
    expect(cachedData).toEqual(mockCapabilities);
  });
});
