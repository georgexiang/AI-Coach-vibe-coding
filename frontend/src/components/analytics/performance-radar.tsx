import {
  ResponsiveContainer,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import { useTranslation } from "react-i18next";

interface DimensionPoint {
  dimension: string;
  score: number;
}

interface PerformanceRadarProps {
  currentScores: DimensionPoint[];
  previousScores?: DimensionPoint[];
  height?: number;
}

export function PerformanceRadar({
  currentScores,
  previousScores,
  height = 280,
}: PerformanceRadarProps) {
  const { t } = useTranslation("analytics");

  const data = currentScores.map((item) => {
    const prev = previousScores?.find((p) => p.dimension === item.dimension);
    return {
      dimension: t(`dimension_${item.dimension}`, { defaultValue: item.dimension }),
      current: item.score,
      previous: prev?.score ?? 0,
    };
  });

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data}>
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "#64748B", fontSize: 12 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#94A3B8", fontSize: 10 }} />
          <Tooltip />
          {previousScores && previousScores.length > 0 && (
            <Radar
              name="Previous"
              dataKey="previous"
              stroke="#94A3B8"
              strokeDasharray="5 5"
              fill="none"
            />
          )}
          <Radar
            name="Current"
            dataKey="current"
            stroke="#1E40AF"
            fill="#1E40AF"
            fillOpacity={0.3}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
