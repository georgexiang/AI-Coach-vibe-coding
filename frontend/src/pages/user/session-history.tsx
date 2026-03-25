import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, TrendingUp, TrendingDown, Search } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  Legend,
} from "recharts";
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useScoreHistory } from "@/hooks/use-scoring";
import { PerformanceRadar } from "@/components/analytics";

const DIMENSION_COLORS = [
  "#1E40AF",
  "#059669",
  "#D97706",
  "#DC2626",
  "#7C3AED",
];

const ALL_VALUE = "__all__";
const PAGE_SIZE = 10;

export default function SessionHistory() {
  const { t } = useTranslation("scoring");
  const navigate = useNavigate();
  const { data: history, isLoading } = useScoreHistory(50);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [modeFilter, setModeFilter] = useState(ALL_VALUE);
  const [scoreFilter, setScoreFilter] = useState(ALL_VALUE);
  const [page, setPage] = useState(1);

  // Filter logic
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    return history.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        item.scenario_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMode =
        modeFilter === ALL_VALUE ||
        (modeFilter === "passed" && item.passed) ||
        (modeFilter === "failed" && !item.passed);
      const matchesScore =
        scoreFilter === ALL_VALUE ||
        (scoreFilter === "high" && item.overall_score >= 80) ||
        (scoreFilter === "mid" && item.overall_score >= 60 && item.overall_score < 80) ||
        (scoreFilter === "low" && item.overall_score < 60);
      return matchesSearch && matchesMode && matchesScore;
    });
  }, [history, searchTerm, modeFilter, scoreFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const pagedHistory = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredHistory.slice(start, start + PAGE_SIZE);
  }, [filteredHistory, page]);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  // Prepare trend chart data
  const chartData = useMemo(() => {
    if (!history) return [];
    return [...history].reverse().map((item) => {
      const point: Record<string, string | number> = {
        date: item.completed_at
          ? new Date(item.completed_at).toLocaleDateString()
          : "",
        overall: item.overall_score,
      };
      for (const dim of item.dimensions) {
        point[dim.dimension] = dim.score;
      }
      return point;
    });
  }, [history]);

  const dimensionNames = useMemo(() => {
    if (!history || history.length === 0) return [];
    const first = history[0];
    if (!first) return [];
    return first.dimensions.map((d) => d.dimension);
  }, [history]);

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="mx-auto max-w-5xl p-4 lg:p-8">
        <h1 className="mb-6 text-3xl font-semibold">{t("history.title")}</h1>
        <div className="rounded-md border px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t("history.noSessions")}
          </p>
        </div>
      </div>
    );
  }

  const latestSession = history[0];
  const latestRadarScores = latestSession
    ? latestSession.dimensions.map((d) => ({ dimension: d.dimension, score: d.score }))
    : [];
  const previousSession = history[1];
  const previousRadarScores = previousSession
    ? previousSession.dimensions.map((d) => ({ dimension: d.dimension, score: d.score }))
    : undefined;

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-8">
      <h1 className="mb-6 text-3xl font-semibold">{t("history.title")}</h1>

      {/* Skill overview radar */}
      {latestRadarScores.length > 0 && (
        <div className="mb-8 rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            {t("history.skillOverview", { defaultValue: "Skill Overview" })}
          </h2>
          <PerformanceRadar
            currentScores={latestRadarScores}
            previousScores={previousRadarScores}
            height={280}
          />
        </div>
      )}

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="mb-8 rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">{t("history.trend")}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="overall"
                  name="Overall"
                  stroke="#0F172A"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                {dimensionNames.map((dim, idx) => (
                  <Line
                    key={dim}
                    type="monotone"
                    dataKey={dim}
                    name={dim}
                    stroke={DIMENSION_COLORS[idx % DIMENSION_COLORS.length]}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("history.searchPlaceholder", { defaultValue: "Search scenarios..." })}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select value={modeFilter} onValueChange={handleFilterChange(setModeFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>
              {t("history.allResults", { defaultValue: "All Results" })}
            </SelectItem>
            <SelectItem value="passed">{t("passed")}</SelectItem>
            <SelectItem value="failed">{t("failed")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scoreFilter} onValueChange={handleFilterChange(setScoreFilter)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>
              {t("history.allScores", { defaultValue: "All Scores" })}
            </SelectItem>
            <SelectItem value="high">
              {t("history.scoreHigh", { defaultValue: "80+ (High)" })}
            </SelectItem>
            <SelectItem value="mid">
              {t("history.scoreMid", { defaultValue: "60-79 (Mid)" })}
            </SelectItem>
            <SelectItem value="low">
              {t("history.scoreLow", { defaultValue: "<60 (Low)" })}
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredHistory.length} {t("history.results", { defaultValue: "results" })}
        </span>
      </div>

      {/* History table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50/50">
              <th className="px-4 py-3 text-left font-medium">
                {t("history.date")}
              </th>
              <th className="px-4 py-3 text-left font-medium">
                {t("history.scenario")}
              </th>
              <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">
                {t("history.mode", { defaultValue: "Mode" })}
              </th>
              <th className="px-4 py-3 text-left font-medium">
                {t("history.score")}
              </th>
              <th className="px-4 py-3 text-left font-medium">
                {t("history.duration", { defaultValue: "Duration" })}
              </th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                {t("rubrics.dimensions", { ns: "admin", defaultValue: "Dimensions" })}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t("history.viewDetails")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedHistory.map((item) => (
              <tr
                key={item.session_id}
                className="cursor-pointer border-b transition-colors hover:bg-slate-50/50"
                onClick={() => navigate(`/user/scoring/${item.session_id}`)}
              >
                <td className="px-4 py-3 text-muted-foreground">
                  {item.completed_at
                    ? new Date(item.completed_at).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3 font-medium">
                  {item.scenario_name}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Badge variant="outline" className="text-xs">
                    F2F
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-7 w-10 items-center justify-center rounded font-semibold text-xs",
                        item.overall_score >= 80
                          ? "bg-green-100 text-green-700"
                          : item.overall_score >= 60
                            ? "bg-orange-100 text-orange-700"
                            : "bg-red-100 text-red-700",
                      )}
                    >
                      {item.overall_score}
                    </span>
                    <Badge
                      className={cn(
                        "text-xs",
                        item.passed
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700",
                      )}
                    >
                      {item.passed ? t("passed") : t("failed")}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">--</td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <div className="flex items-center gap-2">
                    {item.dimensions.slice(0, 3).map((dim) => (
                      <div
                        key={dim.dimension}
                        className="flex items-center gap-1"
                      >
                        <div className="h-1.5 w-8 overflow-hidden rounded-full bg-accent">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              dim.score >= 80
                                ? "bg-green-500"
                                : dim.score >= 60
                                  ? "bg-orange-500"
                                  : "bg-red-500",
                            )}
                            style={{ width: `${dim.score}%` }}
                          />
                        </div>
                        {dim.improvement_pct != null && dim.improvement_pct !== 0 && (
                          <span
                            className={cn(
                              "text-xs",
                              dim.improvement_pct > 0
                                ? "text-green-600"
                                : "text-red-600",
                            )}
                          >
                            {dim.improvement_pct > 0 ? (
                              <TrendingUp className="inline size-3" />
                            ) : (
                              <TrendingDown className="inline size-3" />
                            )}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-primary hover:underline">
                    {t("history.viewDetails")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("history.previous", { defaultValue: "Previous" })}
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("history.next", { defaultValue: "Next" })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
