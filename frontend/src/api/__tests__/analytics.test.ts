import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import {
  getUserDashboardStats,
  getDimensionTrends,
  getOrgAnalytics,
  getRecommendedScenarios,
  downloadSessionsExcel,
  downloadAdminReportExcel,
} from "@/api/analytics";
import type {
  UserDashboardStats,
  DimensionTrendPoint,
  OrgAnalytics,
  RecommendedScenarioItem,
} from "@/types/analytics";

// Mock file-saver
vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

// Mock the api client
vi.mock("@/api/client", () => {
  const getMock = vi.fn();
  return {
    default: { get: getMock },
  };
});

import apiClient from "@/api/client";
import { saveAs } from "file-saver";

const mockedGet = vi.mocked(apiClient.get);
const mockedSaveAs = vi.mocked(saveAs);

function makeAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  };
}

const mockStats: UserDashboardStats = {
  total_sessions: 10,
  avg_score: 80,
  this_week: 3,
  improvement: 5,
};

const mockTrends: DimensionTrendPoint[] = [
  {
    session_id: "s1",
    completed_at: "2025-01-01T00:00:00Z",
    scenario_name: "Test",
    overall_score: 75,
    dimensions: [{ dimension: "Knowledge", score: 80, weight: 0.5 }],
  },
];

const mockOrgAnalytics: OrgAnalytics = {
  total_users: 50,
  active_users: 30,
  completion_rate: 60,
  total_sessions: 200,
  avg_org_score: 71,
  bu_stats: [],
  skill_gaps: [],
};

const mockRecommendations: RecommendedScenarioItem[] = [
  {
    scenario_id: "sc1",
    scenario_name: "Dr. Test",
    product: "ProductA",
    difficulty: "Advanced",
    reason: "Needs practice",
    target_dimension: "Knowledge",
  },
];

describe("getUserDashboardStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GET /analytics/dashboard", async () => {
    mockedGet.mockResolvedValue(makeAxiosResponse(mockStats));
    const result = await getUserDashboardStats();
    expect(mockedGet).toHaveBeenCalledWith("/analytics/dashboard");
    expect(result).toEqual(mockStats);
  });
});

describe("getDimensionTrends", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GET /analytics/trends without params when no limit", async () => {
    mockedGet.mockResolvedValue(makeAxiosResponse(mockTrends));
    const result = await getDimensionTrends();
    expect(mockedGet).toHaveBeenCalledWith("/analytics/trends", {
      params: undefined,
    });
    expect(result).toEqual(mockTrends);
  });

  it("passes limit param when provided", async () => {
    mockedGet.mockResolvedValue(makeAxiosResponse(mockTrends));
    const result = await getDimensionTrends(5);
    expect(mockedGet).toHaveBeenCalledWith("/analytics/trends", {
      params: { limit: 5 },
    });
    expect(result).toEqual(mockTrends);
  });
});

describe("getOrgAnalytics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GET /analytics/admin/overview", async () => {
    mockedGet.mockResolvedValue(makeAxiosResponse(mockOrgAnalytics));
    const result = await getOrgAnalytics();
    expect(mockedGet).toHaveBeenCalledWith("/analytics/admin/overview");
    expect(result).toEqual(mockOrgAnalytics);
  });
});

describe("getRecommendedScenarios", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GET /analytics/recommendations without params when no limit", async () => {
    mockedGet.mockResolvedValue(makeAxiosResponse(mockRecommendations));
    const result = await getRecommendedScenarios();
    expect(mockedGet).toHaveBeenCalledWith("/analytics/recommendations", {
      params: undefined,
    });
    expect(result).toEqual(mockRecommendations);
  });

  it("passes limit param when provided", async () => {
    mockedGet.mockResolvedValue(makeAxiosResponse(mockRecommendations));
    const result = await getRecommendedScenarios(3);
    expect(mockedGet).toHaveBeenCalledWith("/analytics/recommendations", {
      params: { limit: 3 },
    });
    expect(result).toEqual(mockRecommendations);
  });
});

describe("downloadSessionsExcel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GET /analytics/export/sessions with blob responseType", async () => {
    const blobData = new Blob(["test"], { type: "application/octet-stream" });
    mockedGet.mockResolvedValue(makeAxiosResponse(blobData));
    await downloadSessionsExcel();
    expect(mockedGet).toHaveBeenCalledWith("/analytics/export/sessions", {
      responseType: "blob",
    });
    expect(mockedSaveAs).toHaveBeenCalledOnce();
    const [savedData, savedName] = mockedSaveAs.mock.calls[0] as [Blob, string];
    expect(savedData).toBe(blobData);
    expect(savedName).toMatch(/^sessions-report-\d+\.xlsx$/);
  });
});

describe("downloadAdminReportExcel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GET /analytics/export/admin-report with blob responseType", async () => {
    const blobData = new Blob(["admin-data"], { type: "application/octet-stream" });
    mockedGet.mockResolvedValue(makeAxiosResponse(blobData));
    await downloadAdminReportExcel();
    expect(mockedGet).toHaveBeenCalledWith("/analytics/export/admin-report", {
      responseType: "blob",
    });
    expect(mockedSaveAs).toHaveBeenCalledOnce();
    const [savedData, savedName] = mockedSaveAs.mock.calls[0] as [Blob, string];
    expect(savedData).toBe(blobData);
    expect(savedName).toMatch(/^admin-report-\d+\.xlsx$/);
  });
});
