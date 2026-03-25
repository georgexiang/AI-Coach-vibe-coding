import { saveAs } from "file-saver";
import apiClient from "./client";
import type {
  UserDashboardStats,
  DimensionTrendPoint,
  OrgAnalytics,
  RecommendedScenarioItem,
} from "@/types/analytics";

export async function getUserDashboardStats(): Promise<UserDashboardStats> {
  const { data } = await apiClient.get<UserDashboardStats>("/analytics/dashboard");
  return data;
}

export async function getDimensionTrends(limit?: number): Promise<DimensionTrendPoint[]> {
  const { data } = await apiClient.get<DimensionTrendPoint[]>("/analytics/trends", {
    params: limit ? { limit } : undefined,
  });
  return data;
}

export async function getOrgAnalytics(): Promise<OrgAnalytics> {
  const { data } = await apiClient.get<OrgAnalytics>("/analytics/admin/overview");
  return data;
}

export async function getRecommendedScenarios(
  limit?: number,
): Promise<RecommendedScenarioItem[]> {
  const { data } = await apiClient.get<RecommendedScenarioItem[]>(
    "/analytics/recommendations",
    {
      params: limit ? { limit } : undefined,
    },
  );
  return data;
}

export async function downloadSessionsExcel(): Promise<void> {
  const { data } = await apiClient.get("/analytics/export/sessions", {
    responseType: "blob",
  });
  saveAs(data, `sessions-report-${Date.now()}.xlsx`);
}

export async function downloadAdminReportExcel(): Promise<void> {
  const { data } = await apiClient.get("/analytics/export/admin-report", {
    responseType: "blob",
  });
  saveAs(data, `admin-report-${Date.now()}.xlsx`);
}
