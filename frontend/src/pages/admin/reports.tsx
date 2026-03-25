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
import { useExportAdminReport, useExportSessionsExcel } from "@/hooks/use-analytics";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const groupPerformanceData = [
  { name: "Oncology", score: 78 },
  { name: "Hematology", score: 82 },
  { name: "Immunology", score: 65 },
  { name: "Neurology", score: 58 },
];

const scoreTrendData = [
  { month: "Oct", overall: 68, benchmark: 75 },
  { month: "Nov", overall: 70, benchmark: 75 },
  { month: "Dec", overall: 72, benchmark: 75 },
  { month: "Jan", overall: 71, benchmark: 75 },
  { month: "Feb", overall: 74, benchmark: 75 },
  { month: "Mar", overall: 76, benchmark: 75 },
];

const completionData = [
  { team: "Team Alpha", completion: 92 },
  { team: "Team Beta", completion: 85 },
  { team: "Team Gamma", completion: 78 },
  { team: "Team Delta", completion: 71 },
  { team: "Team Epsilon", completion: 64 },
];

const skillGapData = [
  { bu: "Oncology", productKnowledge: 82, communication: 76, objectionHandling: 68, closingSkills: 74, compliance: 88 },
  { bu: "Hematology", productKnowledge: 85, communication: 80, objectionHandling: 72, closingSkills: 78, compliance: 90 },
  { bu: "Immunology", productKnowledge: 70, communication: 65, objectionHandling: 58, closingSkills: 62, compliance: 75 },
  { bu: "Neurology", productKnowledge: 64, communication: 60, objectionHandling: 55, closingSkills: 58, compliance: 70 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBarColor(value: number): string {
  if (value >= 80) return "#22c55e";
  if (value >= 60) return "#3b82f6";
  return "#f97316";
}

function getScoreCellClass(value: number): string {
  if (value >= 80) return "bg-green-100 text-green-800";
  if (value >= 60) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminReportsPage() {
  const { t } = useTranslation("analytics");
  const exportSessions = useExportSessionsExcel();
  const exportAdmin = useExportAdminReport();

  const [buFilter, setBuFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {t("orgAnalytics", { defaultValue: "Organization Analytics" })}
          </h1>
          <p className="mt-1 text-muted-foreground">
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
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            {t("exportSessions", { defaultValue: "Export Sessions" })}
          </Button>
          <Button
            size="sm"
            onClick={() => exportAdmin.mutate()}
            disabled={exportAdmin.isPending}
          >
            {exportAdmin.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            {t("exportFullReport", { defaultValue: "Export Full Report" })}
          </Button>
        </div>
      </div>

      {/* ---- Filters ---- */}
      <Card>
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

      {/* ---- Summary stat cards ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalSessions", { defaultValue: "Total Sessions" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">1,247</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("averageScore", { defaultValue: "Average Score" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">73.8</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("passRate", { defaultValue: "Pass Rate" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">68%</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("activeUsers", { defaultValue: "Active Users" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-violet-600">156</p>
          </CardContent>
        </Card>
      </div>

      {/* ---- 2x2 chart grid ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* -- Group Performance (BarChart) -- */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t("groupPerformance", { defaultValue: "Group Performance" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={groupPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
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
        <Card>
          <CardHeader>
            <CardTitle>
              {t("scoreTrends", { defaultValue: "Score Trends" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scoreTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[50, 100]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="overall"
                  name={t("overallScore", { defaultValue: "Overall Score" })}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name={t("benchmark", { defaultValue: "Benchmark (75)" })}
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* -- Completion Rates (horizontal BarChart) -- */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t("completionRates", { defaultValue: "Completion Rates" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={completionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="team" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="completion"
                  name={t("completionPct", { defaultValue: "Completion %" })}
                  fill="#8b5cf6"
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
        <Card>
          <CardHeader>
            <CardTitle>
              {t("skillGapAnalysis", { defaultValue: "Skill Gap Analysis" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium">
                    {t("buColumn", { defaultValue: "BU" })}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t("productKnowledge", { defaultValue: "Product Knowledge" })}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t("communication", { defaultValue: "Communication" })}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t("objectionHandling", { defaultValue: "Objection Handling" })}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t("closingSkills", { defaultValue: "Closing Skills" })}
                  </th>
                  <th className="pb-2 font-medium">
                    {t("compliance", { defaultValue: "Compliance" })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {skillGapData.map((row) => (
                  <tr key={row.bu} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{row.bu}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${getScoreCellClass(row.productKnowledge)}`}>
                        {row.productKnowledge}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${getScoreCellClass(row.communication)}`}>
                        {row.communication}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${getScoreCellClass(row.objectionHandling)}`}>
                        {row.objectionHandling}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${getScoreCellClass(row.closingSkills)}`}>
                        {row.closingSkills}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${getScoreCellClass(row.compliance)}`}>
                        {row.compliance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
