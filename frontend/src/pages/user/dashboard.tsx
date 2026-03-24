import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle,
  Target,
  Calendar,
  TrendingUp,
  Users,
  Mic,
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

// TODO: Replace with TanStack Query hook in Phase 2
const mockStats = [
  {
    label: "sessionsCompleted",
    value: 24,
    icon: CheckCircle,
    trend: { value: "+3 this week", direction: "up" as const },
  },
  {
    label: "averageScore",
    value: 78,
    icon: Target,
  },
  {
    label: "thisWeek",
    value: 5,
    icon: Calendar,
    progress: { current: 5, total: 7 },
  },
  {
    label: "improvement",
    value: "+12%",
    icon: TrendingUp,
  },
];

// TODO: Replace with TanStack Query hook in Phase 2
const mockSessions = [
  {
    id: "1",
    hcpName: "Dr. Sarah Mitchell",
    specialty: "Cardiology",
    mode: "F2F" as const,
    score: 85,
    timeAgo: "2 hours ago",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=SarahMitchell&backgroundColor=ffd5dc",
  },
  {
    id: "2",
    hcpName: "Dr. James Wong",
    specialty: "Oncology",
    mode: "Conference" as const,
    score: 72,
    timeAgo: "5 hours ago",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=JamesWong&backgroundColor=b6e3f4",
  },
  {
    id: "3",
    hcpName: "Dr. Michael Chen",
    specialty: "Neurology",
    mode: "F2F" as const,
    score: 92,
    timeAgo: "1 day ago",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=MichaelChen&backgroundColor=c0aede",
  },
  {
    id: "4",
    hcpName: "Dr. Emily Roberts",
    specialty: "Endocrinology",
    mode: "Conference" as const,
    score: 55,
    timeAgo: "2 days ago",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=EmilyRoberts&backgroundColor=d1f4d1",
  },
  {
    id: "5",
    hcpName: "Dr. Robert Thompson",
    specialty: "Rheumatology",
    mode: "F2F" as const,
    score: 88,
    timeAgo: "3 days ago",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=RobertThompson&backgroundColor=ffdfba",
  },
];

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

  const userName = user?.full_name ?? user?.username ?? tc("user");

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
        {mockStats.map((stat, index) => (
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
            <Button variant="link" className="text-primary" onClick={() => navigate("/user/training")}>
              {t("viewAll")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {mockSessions.map((session) => (
              <SessionItem
                key={session.id}
                hcpName={session.hcpName}
                specialty={session.specialty}
                mode={session.mode}
                score={session.score}
                timeAgo={session.timeAgo}
                avatar={session.avatar}
              />
            ))}
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
