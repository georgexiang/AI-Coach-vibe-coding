import { useTranslation } from "react-i18next";
import {
  Users,
  UserCheck,
  BarChart3,
  Target,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared";
import {
  BuComparisonBar,
  SkillGapHeatmap,
  CompletionRate,
} from "@/components/analytics";
import { useOrgAnalytics } from "@/hooks/use-analytics";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getHeatColor(value: number): string {
  if (value === 0) return "bg-muted";
  if (value <= 2) return "bg-primary/20";
  if (value <= 4) return "bg-primary/40";
  if (value <= 6) return "bg-primary/60";
  return "bg-primary/80";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation("analytics");
  const { data: orgData, isLoading } = useOrgAnalytics();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground">{t("adminDashboard")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("adminDashboardDesc")}</p>
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
      <Card className="bg-card rounded-lg border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">{t("completionRate")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CompletionRate
            rate={orgData?.completion_rate ?? 0}
            totalUsers={orgData?.total_users ?? 0}
            activeUsers={orgData?.active_users ?? 0}
          />
        </CardContent>
      </Card>

      {/* BU comparison + Score Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t("buComparison")}</CardTitle>
          </CardHeader>
          <CardContent>
            {orgData?.bu_stats && orgData.bu_stats.length > 0 ? (
              <BuComparisonBar data={orgData.bu_stats} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("noData")}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {t("scoreDistribution", { defaultValue: "Score Distribution" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orgData?.score_distribution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="range" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md, 8px)",
                    }}
                  />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skill gap heatmap */}
      <Card className="bg-card rounded-lg border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">{t("skillGapHeatmap")}</CardTitle>
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

      {/* Performance Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-chart-3" />
              <CardTitle className="text-base font-medium">
                {t("topPerformers", { defaultValue: "Top Performers" })}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(orgData?.top_performers ?? []).map((user, idx) => (
              <div
                key={user.name}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors duration-150 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-xs font-bold text-primary-foreground",
                      idx === 0
                        ? "bg-chart-3"
                        : idx === 1
                          ? "bg-muted-foreground"
                          : "bg-chart-3/70"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.bu}</p>
                  </div>
                </div>
                <span className="rounded bg-strength/10 px-2 py-0.5 text-sm font-semibold text-strength">
                  {user.score}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-weakness" />
              <CardTitle className="text-base font-medium">
                {t("needsAttention", { defaultValue: "Needs Attention" })}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(orgData?.needs_attention ?? []).map((user) => (
              <div
                key={user.name}
                className="flex items-center justify-between rounded-lg border border-weakness/20 bg-weakness/5 p-3 transition-colors duration-150 hover:bg-weakness/10"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.bu} · {user.sessions} {t("sessions", { defaultValue: "sessions" })}
                  </p>
                </div>
                <span className="rounded bg-destructive/10 px-2 py-0.5 text-sm font-semibold text-destructive">
                  {user.score}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Training Activity Heatmap */}
      <Card className="bg-card rounded-lg border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {t("trainingActivity", { defaultValue: "Training Activity" })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("trainingActivityDesc", {
              defaultValue: "Sessions completed per day over the last 4 weeks",
            })}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Day headers */}
            <div className="flex gap-1 pl-16">
              {DAYS.map((day) => (
                <div key={day} className="flex-1 text-center text-xs text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            {/* Heatmap rows */}
            {(orgData?.training_activity ?? []).map((week, weekIdx) => (
              <div key={weekIdx} className="flex items-center gap-1">
                <span className="w-14 text-right text-xs text-muted-foreground">
                  {t("week", { defaultValue: "Week" })} {weekIdx + 1}
                </span>
                <div className="flex flex-1 gap-1">
                  {week.map((value, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={cn(
                        "flex-1 rounded-sm h-8 flex items-center justify-center text-xs transition-colors duration-150",
                        getHeatColor(value),
                        value > 0 ? "text-foreground/70" : "text-muted-foreground/40"
                      )}
                      title={`${DAYS[dayIdx] ?? ""}: ${value} sessions`}
                    >
                      {value > 0 ? value : ""}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
