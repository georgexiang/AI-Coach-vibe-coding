import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Bar,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { BuStats } from "@/types/analytics";

interface BuComparisonBarProps {
  data: BuStats[];
  height?: number;
}

export function BuComparisonBar({ data, height = 300 }: BuComparisonBarProps) {
  const { t } = useTranslation("analytics");

  const chartData = data.map((bu) => ({
    name: bu.business_unit || t("noData"),
    [t("sessionCount")]: bu.session_count,
    [t("avgScore")]: bu.avg_score,
    [t("userCount")]: bu.user_count,
  }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey={t("sessionCount")} fill="#1E40AF" radius={[4, 4, 0, 0]} />
          <Bar dataKey={t("avgScore")} fill="#059669" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
