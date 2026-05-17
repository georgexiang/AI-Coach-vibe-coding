import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle,
  Target,
  Calendar,
  TrendingUp,
  Users,
  Mic,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import {
  StatCard,
  SessionItem,
  ActionCard,
  RecommendedScenario,
  MiniRadarChart,
  MiniTrendChart,
  LoadingState,
  EmptyState,
} from "@/components/shared";
import { PerformanceRadar } from "@/components/analytics";
import { useAuthStore } from "@/stores/auth-store";
import { useScoreHistory } from "@/hooks/use-scoring";
import { useUserSessions } from "@/hooks/use-session";
import {
  useDashboardStats,
  useRecommendedScenarios,
  useExportSessionsExcel,
} from "@/hooks/use-analytics";

function getChartForStat(index: number): React.ReactNode {
  if (index === 0 || index === 3) {
    return <MiniTrendChart />;
  }
  if (index === 1) {
    return <MiniRadarChart />;
  }
  return undefined;
}

export default function UserDashboard() {
  const { t } = useTranslation("dashboard");
  const { t: ta } = useTranslation("analytics");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: scoredSessions, isLoading: scoredLoading } = useScoreHistory(5);
  const { data: sessionsData, isLoading: userSessionsLoading } = useUserSessions({ page: 1, page_size: 5 });
  const { data: dashStats } = useDashboardStats();
  const { data: recommended } = useRecommendedScenarios(1);
  const exportExcel = useExportSessionsExcel();

  const sessionsLoading = scoredLoading || userSessionsLoading;

  // Merge scored sessions and completed (unscored) sessions for the recent list
  const recentSessions = (() => {
    const items: Array<{
      session_id: string;
      scenario_name: string;
      overall_score: number | null;
      completed_at: string | null;
    }> = [];
    const seenIds = new Set<string>();

    // Add scored sessions first (they have scores)
    if (scoredSessions) {
      for (const s of scoredSessions) {
        seenIds.add(s.session_id);
        items.push({
          session_id: s.session_id,
          scenario_name: s.scenario_name,
          overall_score: s.overall_score,
          completed_at: s.completed_at,
        });
      }
    }

    // Add completed (unscored) sessions
    if (sessionsData?.items) {
      for (const s of sessionsData.items) {
        if (!seenIds.has(s.id) && (s.status === "completed" || s.status === "scored")) {
          seenIds.add(s.id);
          items.push({
            session_id: s.id,
            scenario_name: s.scenario_name || s.scenario_id,
            overall_score: null,
            completed_at: s.completed_at,
          });
        }
      }
    }

    // Sort by completed_at descending, limit to 5
    items.sort((a, b) => {
      const dateA = new Date(a.completed_at || "").getTime() || 0;
      const dateB = new Date(b.completed_at || "").getTime() || 0;
      return dateB - dateA;
    });

    return items.slice(0, 5);
  })();

  const userName = user?.full_name ?? user?.username ?? tc("user");

  const stats = [
    {
      label: "sessionsCompleted",
      value: dashStats?.total_sessions ?? 0,
      icon: CheckCircle,
      colorClass: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
      trend: undefined,
    },
    {
      label: "averageScore",
      value: dashStats?.avg_score ?? 0,
      icon: Target,
      colorClass: "bg-primary/10 text-primary",
      trend: undefined,
    },
    {
      label: "thisWeek",
      value: dashStats?.this_week ?? 0,
      icon: Calendar,
      colorClass: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
      progress: undefined,
    },
    {
      label: "improvement",
      colorClass: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
      value: dashStats?.improvement != null
        ? `${dashStats.improvement > 0 ? "+" : ""}${dashStats.improvement}`
        : ta("noImprovement"),
      icon: TrendingUp,
      trend: dashStats?.improvement != null
        ? { value: `${dashStats.improvement > 0 ? "+" : ""}${dashStats.improvement}`, direction: dashStats.improvement >= 0 ? "up" as const : "down" as const }
        : undefined,
    },
  ];

  // Latest scored session dimensions for radar chart (from score history)
  const latestScoredSession = scoredSessions?.[0];
  const radarScores = latestScoredSession?.dimensions.map((d) => ({
    dimension: d.dimension,
    score: d.score,
  }));

  // Recommended scenario from API
  const recScenario = recommended?.[0];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-medium text-foreground">
          {t("welcome", { name: userName })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("overview")}</p>
      </div>

      {/* Row 1: 4-column stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={t(stat.label)}
            value={stat.value}
            icon={stat.icon}
            colorClass={stat.colorClass}
            trend={stat.trend}
            progress={stat.progress}
            chart={getChartForStat(index)}
          />
        ))}
      </div>

      {/* Row 2: Recent sessions + actions (60/40 split) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Recent Training Sessions */}
        <Card className="bg-card lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">{t("recentSessions")}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportExcel.mutate()}
                disabled={exportExcel.isPending}
                className="transition-colors duration-150"
              >
                <Download className="mr-1 size-4" />
                {exportExcel.isPending ? ta("exportingExcel") : ta("exportExcel")}
              </Button>
              <Button variant="link" className="text-primary" onClick={() => navigate("/user/history")}>
                {t("viewAll")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {sessionsLoading ? (
              <LoadingState variant="card" />
            ) : recentSessions && recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <SessionItem
                  key={session.session_id}
                  hcpName={session.scenario_name}
                  specialty=""
                  mode="F2F"
                  score={session.overall_score}
                  timeAgo={session.completed_at ? new Date(session.completed_at).toLocaleDateString() : "-"}
                  onClick={() => navigate(`/user/scoring/${session.session_id}`)}
                />
              ))
            ) : (
              <EmptyState
                title={t("noSessions")}
                body={t("noSessionsBody")}
              />
            )}
          </CardContent>
        </Card>

        {/* Right: Action cards + recommended scenario + skill overview */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-base font-medium">{t("startTraining")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionCard
                title={t("f2fTraining")}
                description={t("f2fDescription")}
                icon={Users}
                gradient="blue"
                onStart={() => navigate("/user/training")}
              />

              <ActionCard
                title={t("conferenceTraining")}
                description={t("conferenceDescription")}
                icon={Mic}
                gradient="purple"
                onStart={() => navigate("/user/training")}
              />
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {t("recommendedScenario")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RecommendedScenario
                hcpName={recScenario?.scenario_name ?? "---"}
                difficulty={recScenario?.difficulty ?? tc("difficultyIntermediate")}
                onStart={() => navigate("/user/training")}
              />
              {recScenario?.reason && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {recScenario.reason}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Skill Overview Radar */}
          {radarScores && radarScores.length > 0 && (
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t("skillOverview")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceRadar currentScores={radarScores} height={240} />
              </CardContent>
            </Card>
          )}

          {/* View Reports link */}
          <Card className="bg-card">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm font-medium text-foreground">{t("viewReports")}</p>
                <p className="text-xs text-muted-foreground">{t("viewReportsDesc")}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/user/reports")}>
                <TrendingUp className="mr-1.5 size-4" />
                {t("goToReports")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
