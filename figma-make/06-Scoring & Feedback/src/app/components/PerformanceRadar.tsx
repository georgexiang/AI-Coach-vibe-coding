import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

interface RadarDataPoint {
  dimension: string;
  current: number;
  previous: number;
}

interface PerformanceRadarProps {
  data: RadarDataPoint[];
}

export function PerformanceRadar({ data }: PerformanceRadarProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: '#6b7280', fontSize: 12 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: '#9ca3af', fontSize: 10 }}
        />
        <Radar
          name="Previous Session"
          dataKey="previous"
          stroke="#9ca3af"
          fill="#9ca3af"
          fillOpacity={0.1}
          strokeDasharray="5 5"
        />
        <Radar
          name="Current Session"
          dataKey="current"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.4}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
