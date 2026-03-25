import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle,
  Target,
  Calendar,
  TrendingUp,
  Users,
  Mic,
  Loader2,
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
} from "@/components/shared";
import { PerformanceRadar } from "@/components/analytics";
import { useAuthStore } from "@/stores/auth-store";
import { useScoreHistory } from "@/hooks/use-scoring";
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
  const { data: recentSessions, isLoading: sessionsLoading } = useScoreHistory(5);
  const { data: dashStats } = useDashboardStats();
  const { data: recommended } = useRecommendedScenarios(1);
  const exportExcel = useExportSessionsExcel();

  const userName = user?.full_name ?? user?.username ?? tc("user");

  const stats = [
    {
      label: "sessionsCompleted",
      value: dashStats?.total_sessions ?? 0,
      icon: CheckCircle,
      trend: undefined,
    },
    {
      label: "averageScore",
      value: dashStats?.avg_score ?? 0,
      icon: Target,
      trend: undefined,
    },
    {
      label: "thisWeek",
      value: dashStats?.this_week ?? 0,
      icon: Calendar,
      progress: undefined,
    },
    {
      label: "improvement",
      value: dashStats?.improvement != null
        ? `${dashStats.improvement > 0 ? "+" : ""}${dashStats.improvement}`
        : ta("noImprovement", { defaultValue: "--" }),
      icon: TrendingUp,
      trend: dashStats?.improvement != null
        ? { value: `${dashStats.improvement > 0 ? "+" : ""}${dashStats.improvement}`, direction: dashStats.improvement >= 0 ? "up" as const : "down" as const }
        : undefined,
    },
  ];

  // Latest session dimensions for radar chart
  const latestSession = recentSessions?.[0];
  const radarScores = latestSession?.dimensions.map((d) => ({
    dimension: d.dimension,
    score: d.score,
  }));

  // Recommended scenario from API
  const recScenario = recommended?.[0];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground">
          {t("welcome", { name: userName })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("overview")}</p>
      </div>

      {/* Row 1: 4-column stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={t(stat.label)}
            value={stat.value}
            icon={stat.icon}
            trend={stat.trend}
            progress={stat.progress}
            chart={getChartForStat(index)}
          />
        ))}
      </div>

      {/* Row 2: Recent sessions + actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Recent Training Sessions */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("recentSessions")}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportExcel.mutate()}
                disabled={exportExcel.isPending}
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
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : recentSessions && recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <SessionItem
                  key={session.session_id}
                  hcpName={session.scenario_name}
                  specialty=""
                  mode="F2F"
                  score={session.overall_score}
                  timeAgo={new Date(session.completed_at).toLocaleDateString()}
                  onClick={() => navigate(`/user/scoring/${session.session_id}`)}
                />
              ))
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("noSessions", { defaultValue: "No sessions yet. Start training!" })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right: Action cards + recommended scenario + skill overview */}
        <div className="flex flex-col gap-6 lg:col-span-2">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("recommendedScenario")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RecommendedScenario
                hcpName={recScenario?.scenario_name ?? "---"}
                difficulty={recScenario?.difficulty ?? "Intermediate"}
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("skillOverview")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceRadar currentScores={radarScores} height={240} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
