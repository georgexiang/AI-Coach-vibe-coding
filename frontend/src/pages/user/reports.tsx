import { useTranslation } from "react-i18next";
import {
  Download,
  Printer,
  TrendingUp,
  Target,
  Award,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { LoadingState, EmptyState } from "@/components/shared";
import { PerformanceRadar, TrendLineChart } from "@/components/analytics";
import {
  useDashboardStats,
  useDimensionTrends,
  useRecommendedScenarios,
  useExportSessionsExcel,
} from "@/hooks/use-analytics";

export default function UserReportsPage() {
  const { t } = useTranslation("analytics");
  const { data: dashStats, isLoading: statsLoading } = useDashboardStats();
  const { data: trends, isLoading: trendsLoading } = useDimensionTrends(20);
  const { data: recommendations } = useRecommendedScenarios(3);
  const exportExcel = useExportSessionsExcel();

  const isLoading = statsLoading || trendsLoading;

  // Extract current and previous dimension scores from trends data for radar
  const currentScores =
    trends && trends.length > 0 && trends[0]
      ? trends[0].dimensions.map((d) => ({
          dimension: d.dimension,
          score: d.score,
        }))
      : [];

  const previousScores =
    trends && trends.length > 1 && trends[1]
      ? trends[1].dimensions.map((d) => ({
          dimension: d.dimension,
          score: d.score,
        }))
      : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-medium text-foreground">
          {t("pageTitle", { defaultValue: "Analytics & Reports" })}
        </h1>
        <LoadingState variant="card" />
      </div>
    );
  }

  // Empty state: no sessions yet
  if (dashStats?.total_sessions === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-medium text-foreground">
          {t("pageTitle", { defaultValue: "Analytics & Reports" })}
        </h1>
        <EmptyState
          title={t("noData", { defaultValue: "No data yet" })}
          body={t("noDataBody", { defaultValue: "Complete your first training session to see reports." })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium text-foreground">
          {t("pageTitle", { defaultValue: "Analytics & Reports" })}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="transition-colors duration-150"
          >
            <Printer className="mr-1.5 size-4" />
            {t("exportPdf", { defaultValue: "Print Report" })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportExcel.mutate()}
            disabled={exportExcel.isPending}
            className="transition-colors duration-150"
          >
            <Download className="mr-1.5 size-4" />
            {t("exportExcel", { defaultValue: "Export Excel" })}
          </Button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalSessions", { defaultValue: "Total Sessions" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-medium text-primary">
              {dashStats?.total_sessions ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("avgScore", { defaultValue: "Avg Score" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-medium text-primary">
              {dashStats?.avg_score ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("sessionsThisWeek", { defaultValue: "This Week" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-medium text-green-600 dark:text-green-400">
              {dashStats?.this_week ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("improvement", { defaultValue: "Improvement" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-medium text-foreground">
              {dashStats?.improvement != null
                ? `${dashStats.improvement > 0 ? "+" : ""}${dashStats.improvement}`
                : t("noImprovement", { defaultValue: "N/A" })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Performance Trend */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <TrendingUp className="size-5 text-primary" />
              {t("performanceTrend", { defaultValue: "Performance Trend" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trends && trends.length >= 2 ? (
              <TrendLineChart data={trends} height={300} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("noData", { defaultValue: "Not enough data yet" })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Skill Radar */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Target className="size-5 text-primary" />
              {t("skillGapHeatmap", { defaultValue: "Skill Radar" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentScores.length > 0 ? (
              <PerformanceRadar
                currentScores={currentScores}
                previousScores={previousScores.length > 0 ? previousScores : undefined}
                height={300}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("noData", { defaultValue: "Not enough data yet" })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Award className="size-5 text-primary" />
              {t("recommendations", { defaultValue: "Recommended Scenarios" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-3">
              {recommendations.map((rec) => (
                <div
                  key={rec.scenario_id}
                  className="rounded-lg border border-border bg-muted/40 p-4"
                >
                  <p className="font-medium text-foreground">{rec.scenario_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rec.product} &middot; {rec.difficulty}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {rec.reason}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
