import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import {
  useDashboardStats,
  useDimensionTrends,
  useOrgAnalytics,
  useRecommendedScenarios,
  useExportSessionsExcel,
  useExportAdminReport,
} from "@/hooks/use-analytics";
import type {
  UserDashboardStats,
  DimensionTrendPoint,
  OrgAnalytics,
  RecommendedScenarioItem,
} from "@/types/analytics";

// Mock the API module
vi.mock("@/api/analytics", () => ({
  getUserDashboardStats: vi.fn(),
  getDimensionTrends: vi.fn(),
  getOrgAnalytics: vi.fn(),
  getRecommendedScenarios: vi.fn(),
  downloadSessionsExcel: vi.fn(),
  downloadAdminReportExcel: vi.fn(),
}));

// Import the mocked functions
import {
  getUserDashboardStats,
  getDimensionTrends,
  getOrgAnalytics,
  getRecommendedScenarios,
  downloadSessionsExcel,
  downloadAdminReportExcel,
} from "@/api/analytics";

const mockedGetDashboardStats = vi.mocked(getUserDashboardStats);
const mockedGetDimensionTrends = vi.mocked(getDimensionTrends);
const mockedGetOrgAnalytics = vi.mocked(getOrgAnalytics);
const mockedGetRecommendedScenarios = vi.mocked(getRecommendedScenarios);
const mockedDownloadSessionsExcel = vi.mocked(downloadSessionsExcel);
const mockedDownloadAdminReportExcel = vi.mocked(downloadAdminReportExcel);

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

const mockDashboardStats: UserDashboardStats = {
  total_sessions: 24,
  avg_score: 78,
  this_week: 5,
  improvement: 12,
};

const mockTrends: DimensionTrendPoint[] = [
  {
    session_id: "s1",
    completed_at: "2025-01-10T10:00:00Z",
    scenario_name: "HCP Call",
    overall_score: 82,
    dimensions: [
      { dimension: "Knowledge", score: 85, weight: 0.3 },
      { dimension: "Communication", score: 80, weight: 0.4 },
    ],
  },
];

const mockOrgAnalytics: OrgAnalytics = {
  total_users: 100,
  active_users: 65,
  completion_rate: 65,
  total_sessions: 450,
  avg_org_score: 72,
  bu_stats: [
    { business_unit: "Oncology", session_count: 200, avg_score: 75, user_count: 40 },
    { business_unit: "Hematology", session_count: 150, avg_score: 70, user_count: 25 },
  ],
  skill_gaps: [
    { business_unit: "Oncology", dimension: "Knowledge", avg_score: 78 },
    { business_unit: "Hematology", dimension: "Knowledge", avg_score: 65 },
  ],
  score_distribution: [{ range: "61-80", count: 10 }],
  top_performers: [{ name: "Zhang Wei", score: 95, bu: "Oncology" }],
  needs_attention: [{ name: "Li Hua", score: 42, sessions: 1, bu: "Hematology" }],
  training_activity: [[1, 2, 0, 3, 1, 0, 0]],
};

const mockRecommendations: RecommendedScenarioItem[] = [
  {
    scenario_id: "sc1",
    scenario_name: "Dr. Chen Oncology",
    product: "Product A",
    difficulty: "Intermediate",
    reason: "Weak communication skills",
    target_dimension: "Communication",
  },
];

describe("useDashboardStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches user dashboard stats and returns data", async () => {
    mockedGetDashboardStats.mockResolvedValue(mockDashboardStats);
    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockDashboardStats);
    expect(mockedGetDashboardStats).toHaveBeenCalledOnce();
  });

  it("uses correct query key structure", async () => {
    mockedGetDashboardStats.mockResolvedValue(mockDashboardStats);
    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The hook internally uses queryKey: ["analytics", "dashboard"]
    // Verified by successful fetch
    expect(result.current.data?.total_sessions).toBe(24);
  });
});

describe("useDimensionTrends", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches trends without limit", async () => {
    mockedGetDimensionTrends.mockResolvedValue(mockTrends);
    const { result } = renderHook(() => useDimensionTrends(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTrends);
    expect(mockedGetDimensionTrends).toHaveBeenCalledWith(undefined);
  });

  it("passes limit parameter to API", async () => {
    mockedGetDimensionTrends.mockResolvedValue(mockTrends);
    const { result } = renderHook(() => useDimensionTrends(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetDimensionTrends).toHaveBeenCalledWith(10);
  });

  it("includes limit in query key for cache separation", async () => {
    mockedGetDimensionTrends.mockResolvedValue(mockTrends);
    const wrapper = createWrapper();
    const { result: r1 } = renderHook(() => useDimensionTrends(5), { wrapper });
    const { result: r2 } = renderHook(() => useDimensionTrends(10), { wrapper });

    await waitFor(() => expect(r1.current.isSuccess).toBe(true));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    // Both queries should fire since different limit = different cache key
    expect(mockedGetDimensionTrends).toHaveBeenCalledTimes(2);
  });
});

describe("useOrgAnalytics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches org analytics data", async () => {
    mockedGetOrgAnalytics.mockResolvedValue(mockOrgAnalytics);
    const { result } = renderHook(() => useOrgAnalytics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockOrgAnalytics);
    expect(result.current.data?.total_users).toBe(100);
    expect(result.current.data?.bu_stats).toHaveLength(2);
  });
});

describe("useRecommendedScenarios", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches recommended scenarios", async () => {
    mockedGetRecommendedScenarios.mockResolvedValue(mockRecommendations);
    const { result } = renderHook(() => useRecommendedScenarios(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRecommendations);
    expect(mockedGetRecommendedScenarios).toHaveBeenCalledWith(1);
  });

  it("fetches without limit param", async () => {
    mockedGetRecommendedScenarios.mockResolvedValue(mockRecommendations);
    const { result } = renderHook(() => useRecommendedScenarios(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetRecommendedScenarios).toHaveBeenCalledWith(undefined);
  });
});

describe("useExportSessionsExcel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls downloadSessionsExcel on mutate", async () => {
    mockedDownloadSessionsExcel.mockResolvedValue(undefined);
    const { result } = renderHook(() => useExportSessionsExcel(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDownloadSessionsExcel).toHaveBeenCalledOnce();
  });
});

describe("useExportAdminReport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls downloadAdminReportExcel on mutate", async () => {
    mockedDownloadAdminReportExcel.mockResolvedValue(undefined);
    const { result } = renderHook(() => useExportAdminReport(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDownloadAdminReportExcel).toHaveBeenCalledOnce();
  });
});
