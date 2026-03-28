import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

// Mock auth store
let mockIsAuthenticated = false;
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

// Mock useFeatureFlags
const mockFeatureData = {
  features: {
    avatar_enabled: true,
    voice_enabled: true,
    realtime_voice_enabled: true,
    conference_enabled: true,
    voice_live_enabled: true,
    default_voice_mode: "voice",
    region: "china",
  },
};
let mockUseFeatureFlagsReturn: { data: typeof mockFeatureData | undefined } = {
  data: undefined,
};
vi.mock("@/hooks/use-config", () => ({
  useFeatureFlags: () => mockUseFeatureFlagsReturn,
}));

import { ConfigProvider, useConfig } from "@/contexts/config-context";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>{children}</ConfigProvider>
      </QueryClientProvider>
    );
  };
}

describe("ConfigProvider and useConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    mockUseFeatureFlagsReturn = { data: undefined };
  });

  it("should return default flags when not authenticated", () => {
    mockIsAuthenticated = false;

    const { result } = renderHook(() => useConfig(), {
      wrapper: createWrapper(),
    });

    expect(result.current.avatar_enabled).toBe(false);
    expect(result.current.voice_enabled).toBe(false);
    expect(result.current.realtime_voice_enabled).toBe(false);
    expect(result.current.conference_enabled).toBe(false);
    expect(result.current.default_voice_mode).toBe("text_only");
    expect(result.current.region).toBe("global");
  });

  it("should return default flags when authenticated but data not loaded", () => {
    mockIsAuthenticated = true;
    mockUseFeatureFlagsReturn = { data: undefined };

    const { result } = renderHook(() => useConfig(), {
      wrapper: createWrapper(),
    });

    expect(result.current.avatar_enabled).toBe(false);
    expect(result.current.default_voice_mode).toBe("text_only");
  });

  it("should return fetched flags when authenticated and data available", () => {
    mockIsAuthenticated = true;
    mockUseFeatureFlagsReturn = { data: mockFeatureData };

    const { result } = renderHook(() => useConfig(), {
      wrapper: createWrapper(),
    });

    expect(result.current.avatar_enabled).toBe(true);
    expect(result.current.voice_enabled).toBe(true);
    expect(result.current.realtime_voice_enabled).toBe(true);
    expect(result.current.conference_enabled).toBe(true);
    expect(result.current.default_voice_mode).toBe("voice");
    expect(result.current.region).toBe("china");
  });

  it("should return default flags when not authenticated even if data exists", () => {
    mockIsAuthenticated = false;
    mockUseFeatureFlagsReturn = { data: mockFeatureData };

    const { result } = renderHook(() => useConfig(), {
      wrapper: createWrapper(),
    });

    // Not authenticated, so defaults are used
    expect(result.current.avatar_enabled).toBe(false);
    expect(result.current.voice_enabled).toBe(false);
  });
});
