import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TrendingUp, TrendingDown, Search } from "lucide-react";
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
import { LoadingState, EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useScoreHistory } from "@/hooks/use-scoring";
import { PerformanceRadar } from "@/components/analytics";

const ALL_VALUE = "__all__";
const PAGE_SIZE = 10;

export default function SessionHistory() {
  const { t } = useTranslation("scoring");
  const { t: tc } = useTranslation("common");
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
      <div className="space-y-6">
        <h1 className="text-2xl font-medium text-foreground">{t("history.title")}</h1>
        <LoadingState variant="table" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-medium text-foreground">{t("history.title")}</h1>
        <EmptyState
          title={t("history.noSessions")}
          body={t("history.noSessionsBody", { defaultValue: "Start your first training session to track progress." })}
        />
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
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-foreground">{t("history.title")}</h1>

      {/* Skill overview radar */}
      {latestRadarScores.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-lg font-medium text-foreground">
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
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-lg font-medium text-foreground">{t("history.trend")}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="overall"
                  name={t("history.overall")}
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                {dimensionNames.map((dim, idx) => {
                  const colors = [
                    "var(--chart-1)",
                    "var(--chart-2)",
                    "var(--chart-3)",
                    "var(--chart-4)",
                    "var(--chart-5)",
                  ];
                  return (
                    <Line
                      key={dim}
                      type="monotone"
                      dataKey={dim}
                      name={dim}
                      stroke={colors[idx % colors.length]}
                      strokeDasharray="5 5"
                      dot={{ r: 3 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
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

      {/* History table — desktop */}
      <div className="hidden rounded-lg border border-border bg-card sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {t("history.date")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {t("history.scenario")}
              </th>
              <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground md:table-cell">
                {t("history.mode", { defaultValue: "Mode" })}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {t("history.score")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {t("history.duration", { defaultValue: "Duration" })}
              </th>
              <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground lg:table-cell">
                {t("rubrics.dimensions", { ns: "admin", defaultValue: "Dimensions" })}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                {t("history.viewDetails")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedHistory.map((item) => (
              <tr
                key={item.session_id}
                className="cursor-pointer border-b border-border transition-colors hover:bg-muted/50"
                onClick={() => navigate(`/user/scoring/${item.session_id}`)}
              >
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {item.completed_at
                    ? new Date(item.completed_at).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {item.scenario_name}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <Badge variant="outline" className="text-xs">
                    {tc("modeF2F")}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-7 w-10 items-center justify-center rounded text-xs font-semibold",
                        item.overall_score >= 80
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : item.overall_score >= 60
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                      )}
                    >
                      {item.overall_score}
                    </span>
                    <Badge
                      className={cn(
                        "text-xs",
                        item.passed
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                      )}
                    >
                      {item.passed ? t("passed") : t("failed")}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">--</td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <div className="flex items-center gap-2">
                    {item.dimensions.slice(0, 3).map((dim) => (
                      <div
                        key={dim.dimension}
                        className="flex items-center gap-1"
                      >
                        <div className="h-1.5 w-8 overflow-hidden rounded-full bg-muted">
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
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400",
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
                  <span className="text-sm text-primary transition-colors duration-150 hover:underline">
                    {t("history.viewDetails")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-3">
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

      {/* History cards — mobile */}
      <div className="space-y-3 sm:hidden">
        {pagedHistory.map((item) => (
          <div
            key={item.session_id}
            className="cursor-pointer rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            onClick={() => navigate(`/user/scoring/${item.session_id}`)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {item.scenario_name}
              </span>
              <span
                className={cn(
                  "inline-flex h-7 w-10 items-center justify-center rounded text-xs font-semibold",
                  item.overall_score >= 80
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : item.overall_score >= 60
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                )}
              >
                {item.overall_score}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {item.completed_at
                  ? new Date(item.completed_at).toLocaleDateString()
                  : "-"}
              </span>
              <Badge variant="outline" className="text-xs">
                {tc("modeF2F")}
              </Badge>
              <Badge
                className={cn(
                  "text-xs",
                  item.passed
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                )}
              >
                {item.passed ? t("passed") : t("failed")}
              </Badge>
            </div>
          </div>
        ))}

        {/* Mobile pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
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
