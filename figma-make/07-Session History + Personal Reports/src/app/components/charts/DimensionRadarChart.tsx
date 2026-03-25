import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";

const data = [
  {
    dimension: "Communication",
    thisMonth: 85,
    lastMonth: 78,
  },
  {
    dimension: "Scientific Info",
    thisMonth: 68,
    lastMonth: 72,
  },
  {
    dimension: "Objection Handling",
    thisMonth: 82,
    lastMonth: 75,
  },
  {
    dimension: "Relationship",
    thisMonth: 90,
    lastMonth: 88,
  },
  {
    dimension: "Closing",
    thisMonth: 76,
    lastMonth: 70,
  },
];

export default function DimensionRadarChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: "#6b7280", fontSize: 11 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "#6b7280", fontSize: 10 }}
        />
        <Radar
          name="This Month"
          dataKey="thisMonth"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        <Radar
          name="Last Month"
          dataKey="lastMonth"
          stroke="#9ca3af"
          fill="transparent"
          strokeWidth={2}
          strokeDasharray="5 5"
        />
        <Legend
          wrapperStyle={{ paddingTop: "20px" }}
          iconType="line"
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
