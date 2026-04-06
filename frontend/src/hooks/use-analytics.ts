import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getUserDashboardStats,
  getDimensionTrends,
  getOrgAnalytics,
  getRecommendedScenarios,
  getScoreTrends,
  downloadSessionsExcel,
  downloadAdminReportExcel,
} from "@/api/analytics";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: getUserDashboardStats,
  });
}

export function useDimensionTrends(limit?: number) {
  return useQuery({
    queryKey: ["analytics", "trends", limit],
    queryFn: () => getDimensionTrends(limit),
  });
}

export function useOrgAnalytics() {
  return useQuery({
    queryKey: ["analytics", "admin", "overview"],
    queryFn: getOrgAnalytics,
  });
}

export function useRecommendedScenarios(limit?: number) {
  return useQuery({
    queryKey: ["analytics", "recommendations", limit],
    queryFn: () => getRecommendedScenarios(limit),
  });
}

export function useScoreTrends(months?: number) {
  return useQuery({
    queryKey: ["analytics", "admin", "score-trends", months],
    queryFn: () => getScoreTrends(months),
  });
}

export function useExportSessionsExcel() {
  return useMutation({
    mutationFn: downloadSessionsExcel,
  });
}

export function useExportAdminReport() {
  return useMutation({
    mutationFn: downloadAdminReportExcel,
  });
}
