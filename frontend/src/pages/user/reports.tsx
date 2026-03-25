import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  TrendingUp,
  Target,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const scoreTrendData = [
  { name: "Day 1", overall: 68, knowledge: 72, communication: 65, objection: 62 },
  { name: "Day 2", overall: 71, knowledge: 74, communication: 68, objection: 66 },
  { name: "Day 3", overall: 74, knowledge: 76, communication: 72, objection: 70 },
  { name: "Day 4", overall: 72, knowledge: 78, communication: 70, objection: 68 },
  { name: "Day 5", overall: 78, knowledge: 80, communication: 76, objection: 74 },
  { name: "Day 6", overall: 82, knowledge: 83, communication: 80, objection: 78 },
  { name: "Day 7", overall: 85, knowledge: 86, communication: 83, objection: 81 },
];

const skillRadarData = [
  { dimension: "Product Knowledge", current: 86, previous: 72 },
  { dimension: "Communication", current: 83, previous: 68 },
  { dimension: "Objection Handling", current: 78, previous: 62 },
  { dimension: "Clinical Discussion", current: 75, previous: 65 },
  { dimension: "Closing", current: 80, previous: 70 },
];

const trainingFrequencyData = [
  { week: "W1", sessions: 3 },
  { week: "W2", sessions: 5 },
  { week: "W3", sessions: 4 },
  { week: "W4", sessions: 6 },
  { week: "W5", sessions: 7 },
  { week: "W6", sessions: 5 },
  { week: "W7", sessions: 8 },
  { week: "W8", sessions: 6 },
];

const focusAreas = [
  {
    key: "strongest",
    icon: TrendingUp,
    label: "Strongest Skill",
    value: "Product Knowledge",
    detail: "86 avg score — top 15% of peers",
    borderColor: "border-l-emerald-500",
  },
  {
    key: "improvement",
    icon: Target,
    label: "Needs Improvement",
    value: "Clinical Discussion",
    detail: "75 avg score — practice recommended",
    borderColor: "border-l-amber-500",
  },
  {
    key: "practiced",
    icon: MessageSquare,
    label: "Most Practiced",
    value: "Objection Handling",
    detail: "18 sessions this period",
    borderColor: "border-l-blue-500",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UserReportsPage() {
  const { t } = useTranslation("analytics");
  const [period, setPeriod] = useState("week");

  return (
    <div className="mx-auto max-w-7xl p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("personalReports", { defaultValue: "Personal Reports" })}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 size-4" />
            {t("exportPdf", { defaultValue: "Export PDF" })}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 size-4" />
            {t("exportExcel", { defaultValue: "Export Excel" })}
          </Button>
        </div>
      </div>

      {/* Time period tabs */}
      <Tabs value={period} onValueChange={setPeriod} className="mb-6">
        <TabsList>
          <TabsTrigger value="week">
            {t("week", { defaultValue: "Week" })}
          </TabsTrigger>
          <TabsTrigger value="month">
            {t("month", { defaultValue: "Month" })}
          </TabsTrigger>
          <TabsTrigger value="quarter">
            {t("quarter", { defaultValue: "Quarter" })}
          </TabsTrigger>
          <TabsTrigger value="year">
            {t("year", { defaultValue: "Year" })}
          </TabsTrigger>
        </TabsList>

        {/* All tab contents share the same chart grid */}
        {["week", "month", "quarter", "year"].map((p) => (
          <TabsContent key={p} value={p}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* ---- Score Trend (LineChart) ---- */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <TrendingUp className="size-5 text-blue-600" />
                    {t("scoreTrend", { defaultValue: "Score Trend" })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={scoreTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis domain={[50, 100]} fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="overall"
                        name={t("overall", { defaultValue: "Overall" })}
                        stroke="#1E40AF"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="knowledge"
                        name={t("knowledge", { defaultValue: "Knowledge" })}
                        stroke="#059669"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="communication"
                        name={t("communication", { defaultValue: "Communication" })}
                        stroke="#D97706"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="objection"
                        name={t("objectionHandling", { defaultValue: "Objection Handling" })}
                        stroke="#DC2626"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* ---- Skill Radar (RadarChart) ---- */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Target className="size-5 text-emerald-600" />
                    {t("skillRadar", { defaultValue: "Skill Radar" })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={skillRadarData} outerRadius="75%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="dimension" fontSize={11} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} />
                      <Radar
                        name={t("current", { defaultValue: "Current" })}
                        dataKey="current"
                        stroke="#1E40AF"
                        fill="#1E40AF"
                        fillOpacity={0.3}
                      />
                      <Radar
                        name={t("previous", { defaultValue: "Previous" })}
                        dataKey="previous"
                        stroke="#D97706"
                        fill="#D97706"
                        fillOpacity={0.15}
                      />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* ---- Training Frequency (BarChart) ---- */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <BookOpen className="size-5 text-violet-600" />
                    {t("trainingFrequency", { defaultValue: "Training Frequency" })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={trainingFrequencyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <Tooltip />
                      <Bar
                        dataKey="sessions"
                        name={t("sessions", { defaultValue: "Sessions" })}
                        fill="var(--color-primary, #1E40AF)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* ---- Focus Areas ---- */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Target className="size-5 text-amber-600" />
                    {t("focusAreas", { defaultValue: "Focus Areas" })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {focusAreas.map((area) => {
                    const Icon = area.icon;
                    return (
                      <div
                        key={area.key}
                        className={`flex items-start gap-3 rounded-lg border border-l-4 ${area.borderColor} bg-muted/40 p-4`}
                      >
                        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t(`focus.${area.key}`, { defaultValue: area.label })}
                          </p>
                          <p className="text-sm font-semibold">{area.value}</p>
                          <p className="text-xs text-muted-foreground">{area.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
