import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AvatarCharactersResponse } from "@/types/voice-live";

vi.mock("@/api/voice-live", () => ({
  fetchAvatarCharacters: vi.fn(),
}));

import { fetchAvatarCharacters } from "@/api/voice-live";
import { useAvatarCharacters } from "./use-avatar-characters";

const mockedFetchAvatarCharacters = vi.mocked(fetchAvatarCharacters);

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

const mockResponse: AvatarCharactersResponse = {
  characters: [
    {
      id: "lisa",
      display_name: "Lisa",
      gender: "female",
      is_photo_avatar: false,
      styles: [
        { id: "casual-sitting", display_name: "Casual Sitting" },
        { id: "graceful-standing", display_name: "Graceful Standing" },
      ],
      default_style: "casual-sitting",
      thumbnail_url: "https://example.com/lisa.png",
    },
    {
      id: "harry",
      display_name: "Harry",
      gender: "male",
      is_photo_avatar: false,
      styles: [{ id: "business", display_name: "Business" }],
      default_style: "business",
      thumbnail_url: "https://example.com/harry.png",
    },
  ],
};

describe("useAvatarCharacters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches avatar characters and returns data", async () => {
    mockedFetchAvatarCharacters.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useAvatarCharacters(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockedFetchAvatarCharacters).toHaveBeenCalledTimes(1);
  });

  it("returns loading state initially", () => {
    mockedFetchAvatarCharacters.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAvatarCharacters(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("returns error state when fetch fails", async () => {
    mockedFetchAvatarCharacters.mockRejectedValueOnce(
      new Error("Network error"),
    );

    const { result } = renderHook(() => useAvatarCharacters(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });

  it("uses correct query key", async () => {
    mockedFetchAvatarCharacters.mockResolvedValueOnce(mockResponse);

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

    const { result } = renderHook(() => useAvatarCharacters(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cachedData = queryClient.getQueryData(["avatar-characters"]);
    expect(cachedData).toEqual(mockResponse);
  });
});
