import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useScoreHistory } from "@/hooks/use-scoring";

const DIMENSION_COLORS = [
  "#1E40AF",
  "#059669",
  "#D97706",
  "#DC2626",
  "#7C3AED",
];

export default function SessionHistory() {
  const { t } = useTranslation("scoring");
  const navigate = useNavigate();
  const { data: history, isLoading } = useScoreHistory(20);

  // Prepare trend chart data: reverse chronological to show oldest-first on x-axis
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

  // Get unique dimension names for line series
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

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-8">
      <h1 className="mb-6 text-3xl font-semibold">{t("history.title")}</h1>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="mb-8 rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">{t("history.trend")}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748B", fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "#64748B", fontSize: 12 }}
                />
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
              <th className="px-4 py-3 text-left font-medium">
                {t("history.score")}
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
            {history.map((item) => (
              <tr
                key={item.session_id}
                className="cursor-pointer border-b transition-colors hover:bg-slate-50/50"
                onClick={() =>
                  navigate(`/user/scoring?id=${item.session_id}`)
                }
              >
                <td className="px-4 py-3 text-muted-foreground">
                  {item.completed_at
                    ? new Date(item.completed_at).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3 font-medium">
                  {item.scenario_name}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
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
      </div>
    </div>
  );
}
