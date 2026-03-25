import { useTranslation } from "react-i18next";
import {
  Users,
  UserCheck,
  BarChart3,
  Target,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatCard } from "@/components/shared";
import {
  BuComparisonBar,
  SkillGapHeatmap,
  CompletionRate,
} from "@/components/analytics";
import { useOrgAnalytics } from "@/hooks/use-analytics";

export default function AdminDashboard() {
  const { t } = useTranslation("analytics");
  const { data: orgData, isLoading } = useOrgAnalytics();

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("adminDashboard")}</h1>
        <p className="mt-1 text-muted-foreground">{t("adminDashboardDesc")}</p>
      </div>

      {/* Overview stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("totalUsers")}
          value={orgData?.total_users ?? 0}
          icon={Users}
        />
        <StatCard
          label={t("activeUsers")}
          value={orgData?.active_users ?? 0}
          icon={UserCheck}
        />
        <StatCard
          label={t("totalSessions")}
          value={orgData?.total_sessions ?? 0}
          icon={BarChart3}
        />
        <StatCard
          label={t("avgOrgScore")}
          value={orgData?.avg_org_score ?? 0}
          icon={Target}
        />
      </div>

      {/* Completion rate */}
      <Card>
        <CardHeader>
          <CardTitle>{t("completionRate")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CompletionRate
            rate={orgData?.completion_rate ?? 0}
            totalUsers={orgData?.total_users ?? 0}
            activeUsers={orgData?.active_users ?? 0}
          />
        </CardContent>
      </Card>

      {/* BU comparison + skill gap heatmap */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("buComparison")}</CardTitle>
          </CardHeader>
          <CardContent>
            {orgData?.bu_stats && orgData.bu_stats.length > 0 ? (
              <BuComparisonBar data={orgData.bu_stats} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("noData")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("skillGapHeatmap")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("skillGapDesc")}</p>
          </CardHeader>
          <CardContent>
            {orgData?.skill_gaps && orgData.skill_gaps.length > 0 ? (
              <SkillGapHeatmap data={orgData.skill_gaps} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("noData")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
