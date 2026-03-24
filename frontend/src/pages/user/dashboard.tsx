import { useMemo } from "react";
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
import { useAuthStore } from "@/stores/auth-store";
import { useScoreHistory } from "@/hooks/use-scoring";

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
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: recentSessions, isLoading: sessionsLoading } = useScoreHistory(5);

  const userName = user?.full_name ?? user?.username ?? tc("user");

  const stats = useMemo(() => {
    const sessionsCompleted = recentSessions?.length ?? 0;
    const averageScore =
      sessionsCompleted > 0
        ? Math.round(
            recentSessions!.reduce((sum, s) => sum + s.overall_score, 0) /
              sessionsCompleted,
          )
        : 0;

    return [
      {
        label: "sessionsCompleted",
        value: sessionsCompleted,
        icon: CheckCircle,
        trend: undefined,
      },
      {
        label: "averageScore",
        value: averageScore,
        icon: Target,
        trend: undefined,
      },
      {
        label: "thisWeek",
        value: "--",
        icon: Calendar,
        progress: undefined,
      },
      {
        label: "improvement",
        value: "--",
        icon: TrendingUp,
        trend: undefined,
      },
    ];
  }, [recentSessions]);

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
            <Button variant="link" className="text-primary" onClick={() => navigate("/user/history")}>
              {t("viewAll")}
            </Button>
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

        {/* Right: Action cards + recommended scenario */}
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
                hcpName="Dr. Amanda Hayes"
                difficulty="Intermediate"
                onStart={() => navigate("/user/training")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
