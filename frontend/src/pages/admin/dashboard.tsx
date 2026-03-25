import { useTranslation } from "react-i18next";
import {
  Users,
  UserCheck,
  BarChart3,
  Target,
  Loader2,
  AlertTriangle,
  Trophy,
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
import { StatCard } from "@/components/shared";
import {
  BuComparisonBar,
  SkillGapHeatmap,
  CompletionRate,
} from "@/components/analytics";
import { useOrgAnalytics } from "@/hooks/use-analytics";
import { cn } from "@/lib/utils";

// Mock data for score distribution
const SCORE_DISTRIBUTION = [
  { range: "0-20", count: 2 },
  { range: "21-40", count: 8 },
  { range: "41-60", count: 25 },
  { range: "61-80", count: 45 },
  { range: "81-100", count: 32 },
];

// Mock data for performance alerts
const TOP_PERFORMERS = [
  { name: "Zhang Wei", score: 95, bu: "Oncology" },
  { name: "Li Mei", score: 92, bu: "Hematology" },
  { name: "Wang Jun", score: 91, bu: "Oncology" },
];

const NEEDS_ATTENTION = [
  { name: "Chen Fang", score: 38, sessions: 2, bu: "Immunology" },
  { name: "Liu Hua", score: 42, sessions: 1, bu: "Hematology" },
  { name: "Zhao Min", score: 45, sessions: 3, bu: "Oncology" },
];

// Mock data for training activity heatmap (last 4 weeks × 7 days)
const HEATMAP_DATA = [
  [3, 5, 2, 4, 6, 1, 0],
  [4, 3, 5, 2, 7, 2, 1],
  [2, 6, 4, 5, 3, 3, 0],
  [5, 4, 6, 3, 8, 2, 1],
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getHeatColor(value: number): string {
  if (value === 0) return "bg-slate-100";
  if (value <= 2) return "bg-primary/20";
  if (value <= 4) return "bg-primary/40";
  if (value <= 6) return "bg-primary/60";
  return "bg-primary/80";
}

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

      {/* BU comparison + Score Distribution */}
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
            <CardTitle>{t("scoreDistribution", { defaultValue: "Score Distribution" })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SCORE_DISTRIBUTION}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="range" tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skill gap heatmap */}
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

      {/* Performance Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-500" />
              <CardTitle>{t("topPerformers", { defaultValue: "Top Performers" })}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {TOP_PERFORMERS.map((user, idx) => (
              <div key={user.name} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold text-white",
                    idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : "bg-amber-700"
                  )}>
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.bu}</p>
                  </div>
                </div>
                <span className="rounded bg-green-100 px-2 py-0.5 text-sm font-semibold text-green-700">
                  {user.score}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-orange-500" />
              <CardTitle>{t("needsAttention", { defaultValue: "Needs Attention" })}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {NEEDS_ATTENTION.map((user) => (
              <div key={user.name} className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50/50 p-3">
                <div>
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.bu} · {user.sessions} {t("sessions", { defaultValue: "sessions" })}</p>
                </div>
                <span className="rounded bg-red-100 px-2 py-0.5 text-sm font-semibold text-red-700">
                  {user.score}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Training Activity Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>{t("trainingActivity", { defaultValue: "Training Activity" })}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("trainingActivityDesc", { defaultValue: "Sessions completed per day over the last 4 weeks" })}
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
            {HEATMAP_DATA.map((week, weekIdx) => (
              <div key={weekIdx} className="flex items-center gap-1">
                <span className="w-14 text-right text-xs text-muted-foreground">
                  {t("week", { defaultValue: "Week" })} {weekIdx + 1}
                </span>
                <div className="flex flex-1 gap-1">
                  {week.map((value, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={cn(
                        "flex-1 rounded-sm h-8 flex items-center justify-center text-xs",
                        getHeatColor(value),
                        value > 0 ? "text-foreground/70" : "text-muted-foreground/40"
                      )}
                      title={`${DAYS[dayIdx]}: ${value} sessions`}
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
