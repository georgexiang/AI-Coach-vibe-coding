import {
  ResponsiveContainer,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface ScorePoint {
  dimension: string;
  score: number;
}

interface ScoringRadarChartProps {
  currentScores: ScorePoint[];
  previousScores?: ScorePoint[];
}

export function RadarChart({
  currentScores,
  previousScores,
}: ScoringRadarChartProps) {
  // Merge current and previous into a single data array for recharts
  const data = currentScores.map((item) => {
    const prev = previousScores?.find((p) => p.dimension === item.dimension);
    return {
      dimension: item.dimension,
      current: item.score,
      previous: prev?.score ?? 0,
    };
  });

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data}>
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "#64748B", fontSize: 14 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: "#64748B", fontSize: 14 }}
          />
          {previousScores && previousScores.length > 0 && (
            <Radar
              name="Previous"
              dataKey="previous"
              stroke="#475569"
              strokeDasharray="5 5"
              fill="none"
            />
          )}
          <Radar
            name="Current"
            dataKey="current"
            stroke="#1E40AF"
            fill="#1E40AF"
            fillOpacity={0.5}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
