import { useTranslation } from "react-i18next";
import {
  Download,
  Printer,
  Loader2,
  TrendingUp,
  Target,
  BarChart3,
  Award,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
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
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // Empty state: no sessions yet
  if (dashStats?.total_sessions === 0) {
    return (
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">
          {t("pageTitle", { defaultValue: "Analytics & Reports" })}
        </h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="mb-4 size-12 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              {t("noData", {
                defaultValue: "Complete your first training session to see reports",
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("pageTitle", { defaultValue: "Analytics & Reports" })}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="mr-1.5 size-4" />
            {t("exportPdf", { defaultValue: "Print Report" })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportExcel.mutate()}
            disabled={exportExcel.isPending}
          >
            {exportExcel.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 size-4" />
            )}
            {t("exportExcel", { defaultValue: "Export Excel" })}
          </Button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalSessions", { defaultValue: "Total Sessions" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {dashStats?.total_sessions ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("avgScore", { defaultValue: "Avg Score" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {dashStats?.avg_score ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("sessionsThisWeek", { defaultValue: "This Week" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {dashStats?.this_week ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("improvement", { defaultValue: "Improvement" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-violet-600">
              {dashStats?.improvement != null
                ? `${dashStats.improvement > 0 ? "+" : ""}${dashStats.improvement}`
                : t("noImprovement", { defaultValue: "N/A" })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts grid */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Performance Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="size-5 text-blue-600" />
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Target className="size-5 text-emerald-600" />
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Award className="size-5 text-amber-600" />
              {t("recommendations", { defaultValue: "Recommended Scenarios" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {recommendations.map((rec) => (
                <div
                  key={rec.scenario_id}
                  className="rounded-lg border bg-muted/40 p-4"
                >
                  <p className="font-semibold">{rec.scenario_name}</p>
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
