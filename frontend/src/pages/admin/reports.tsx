import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Filter, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Cell,
} from "recharts";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { StatCard } from "@/components/shared";
import {
  useExportAdminReport,
  useExportSessionsExcel,
  useOrgAnalytics,
  useScoreTrends,
} from "@/hooks/use-analytics";
import type { SkillGapCell } from "@/types/analytics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBarColor(value: number): string {
  if (value >= 80) return "var(--color-strength, #22c55e)";
  if (value >= 60) return "var(--color-primary, #3b82f6)";
  return "var(--color-weakness, #f97316)";
}

function getScoreCellClass(value: number): string {
  if (value >= 80) return "bg-strength/10 text-strength";
  if (value >= 60) return "bg-chart-3/10 text-chart-3";
  return "bg-destructive/10 text-destructive";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminReportsPage() {
  const { t } = useTranslation("analytics");
  const exportSessions = useExportSessionsExcel();
  const exportAdmin = useExportAdminReport();
  const { data: orgData } = useOrgAnalytics();
  const { data: scoreTrendData } = useScoreTrends(6);

  const [buFilter, setBuFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");

  // Derive chart data from API responses
  const groupPerformanceData = (orgData?.bu_stats ?? []).map((bu) => ({
    name: bu.business_unit,
    score: bu.avg_score,
  }));

  const completionData = (orgData?.bu_stats ?? []).map((bu) => ({
    team: bu.business_unit,
    completion: bu.user_count > 0
      ? Math.round((bu.session_count / Math.max(bu.user_count, 1)) * 10)
      : 0,
  }));

  // Pivot skill_gaps from flat list to per-BU row objects
  const skillGapData = (() => {
    const gaps = orgData?.skill_gaps ?? [];
    const buMap = new Map<string, Record<string, number>>();
    for (const cell of gaps) {
      if (!buMap.has(cell.business_unit)) {
        buMap.set(cell.business_unit, {});
      }
      buMap.get(cell.business_unit)![cell.dimension] = cell.avg_score;
    }
    return Array.from(buMap.entries()).map(([bu, dims]) => ({
      bu,
      ...dims,
    }));
  })();

  // Extract unique dimensions for table headers
  const skillDimensions = [
    ...new Set((orgData?.skill_gaps ?? []).map((c: SkillGapCell) => c.dimension)),
  ];

  const tooltipStyle = {
    backgroundColor: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md, 8px)",
    color: "var(--color-foreground)",
  };

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">
            {t("orgAnalytics", { defaultValue: "Organization Analytics" })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("orgAnalyticsDesc", {
              defaultValue: "Comprehensive performance overview across all business units",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportSessions.mutate()}
            disabled={exportSessions.isPending}
          >
            {exportSessions.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t("exportSessions", { defaultValue: "Export Sessions" })}
          </Button>
          <Button
            size="sm"
            onClick={() => exportAdmin.mutate()}
            disabled={exportAdmin.isPending}
          >
            {exportAdmin.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t("exportFullReport", { defaultValue: "Export Full Report" })}
          </Button>
        </div>
      </div>

      {/* ---- Filters ---- */}
      <Card className="bg-card border border-border shadow-sm">
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
          <Filter className="hidden size-5 text-muted-foreground sm:block" />

          <Select value={buFilter} onValueChange={setBuFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t("filterBU", { defaultValue: "Business Unit" })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("allBUs", { defaultValue: "All BUs" })}
              </SelectItem>
              <SelectItem value="oncology">
                {t("oncology", { defaultValue: "Oncology" })}
              </SelectItem>
              <SelectItem value="hematology">
                {t("hematology", { defaultValue: "Hematology" })}
              </SelectItem>
              <SelectItem value="immunology">
                {t("immunology", { defaultValue: "Immunology" })}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t("filterRegion", { defaultValue: "Region" })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("allRegions", { defaultValue: "All Regions" })}
              </SelectItem>
              <SelectItem value="north-china">
                {t("northChina", { defaultValue: "North China" })}
              </SelectItem>
              <SelectItem value="south-china">
                {t("southChina", { defaultValue: "South China" })}
              </SelectItem>
              <SelectItem value="east-china">
                {t("eastChina", { defaultValue: "East China" })}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t("filterProduct", { defaultValue: "Product" })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("allProducts", { defaultValue: "All Products" })}
              </SelectItem>
              <SelectItem value="zanubrutinib">Zanubrutinib</SelectItem>
              <SelectItem value="tislelizumab">Tislelizumab</SelectItem>
              <SelectItem value="pamiparib">Pamiparib</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ---- Summary stat cards (live from useOrgAnalytics) ---- */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("totalSessions", { defaultValue: "Total Sessions" })}
          value={orgData?.total_sessions ?? 0}
        />
        <StatCard
          label={t("avgOrgScore", { defaultValue: "Avg Score" })}
          value={orgData?.avg_org_score ?? 0}
        />
        <StatCard
          label={t("completionRate", { defaultValue: "Completion Rate" })}
          value={`${orgData?.completion_rate ?? 0}%`}
        />
        <StatCard
          label={t("activeUsers", { defaultValue: "Active Users" })}
          value={orgData?.active_users ?? 0}
        />
      </div>

      {/* ---- 2x2 chart grid ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* -- Group Performance (BarChart) -- */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader className="p-4">
            <CardTitle className="text-base font-medium">
              {t("groupPerformance", { defaultValue: "Group Performance" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={groupPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar
                  dataKey="score"
                  name={t("avgScore", { defaultValue: "Avg Score" })}
                  radius={[4, 4, 0, 0]}
                >
                  {groupPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* -- Score Trends (LineChart) -- */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader className="p-4">
            <CardTitle className="text-base font-medium">
              {t("scoreTrends", { defaultValue: "Score Trends" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scoreTrendData ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis domain={[50, 100]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="overall"
                  name={t("overallScore", { defaultValue: "Overall Score" })}
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name={t("benchmark", { defaultValue: "Benchmark (75)" })}
                  stroke="var(--color-weakness)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* -- Completion Rates (horizontal BarChart) -- */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader className="p-4">
            <CardTitle className="text-base font-medium">
              {t("completionRates", { defaultValue: "Completion Rates" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={completionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis dataKey="team" type="category" width={100} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar
                  dataKey="completion"
                  name={t("completionPct", { defaultValue: "Completion %" })}
                  fill="var(--color-chart-2, #8b5cf6)"
                  radius={[0, 4, 4, 0]}
                >
                  {completionData.map((entry, index) => (
                    <Cell key={`comp-${index}`} fill={getBarColor(entry.completion)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* -- Skill Gap Analysis (HTML table) -- */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader className="p-4">
            <CardTitle className="text-base font-medium">
              {t("skillGapAnalysis", { defaultValue: "Skill Gap Analysis" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-4 pt-0">
            {skillDimensions.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 text-sm font-medium text-muted-foreground">
                      {t("buColumn", { defaultValue: "BU" })}
                    </th>
                    {skillDimensions.map((dim) => (
                      <th key={dim} className="pb-2 pr-4 text-sm font-medium text-muted-foreground capitalize">
                        {dim.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {skillGapData.map((row) => (
                    <tr key={row.bu} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium text-foreground">{row.bu}</td>
                      {skillDimensions.map((dim) => {
                        const val = (row as Record<string, number | string>)[dim] as number | undefined;
                        return (
                          <td key={dim} className="py-2 pr-4">
                            {val != null ? (
                              <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${getScoreCellClass(val)}`}>
                                {val}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("noData", { defaultValue: "No data available" })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
