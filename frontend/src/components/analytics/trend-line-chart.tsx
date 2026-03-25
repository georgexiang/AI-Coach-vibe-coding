import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { DimensionTrendPoint } from "@/types/analytics";

const DIMENSION_COLORS = [
  "#1E40AF", "#059669", "#D97706", "#DC2626", "#7C3AED",
];

interface TrendLineChartProps {
  data: DimensionTrendPoint[];
  height?: number;
}

export function TrendLineChart({ data, height = 300 }: TrendLineChartProps) {
  const { t } = useTranslation("analytics");

  // Reverse for chronological order (oldest first on x-axis)
  const chartData = [...data].reverse().map((item) => {
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

  // Get unique dimension names from first data point
  const dimensionNames =
    data.length > 0 && data[0]
      ? data[0].dimensions.map((d) => d.dimension)
      : [];

  if (chartData.length < 2) return null;

  return (
    <div style={{ height }}>
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
            name={t("avgScore", { defaultValue: "Overall" })}
            stroke="#0F172A"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          {dimensionNames.map((dim, idx) => (
            <Line
              key={dim}
              type="monotone"
              dataKey={dim}
              name={t(`dimension_${dim}`, { defaultValue: dim })}
              stroke={DIMENSION_COLORS[idx % DIMENSION_COLORS.length]}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
