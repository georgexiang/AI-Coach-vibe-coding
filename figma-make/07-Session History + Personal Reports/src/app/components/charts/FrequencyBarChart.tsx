import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { week: "Week 1", sessions: 5 },
  { week: "Week 2", sessions: 7 },
  { week: "Week 3", sessions: 6 },
  { week: "Week 4", sessions: 8 },
];

export default function FrequencyBarChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="week"
          tick={{ fill: "#6b7280", fontSize: 12 }}
          stroke="#e5e7eb"
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 12 }}
          stroke="#e5e7eb"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            padding: "8px 12px",
          }}
          cursor={{ fill: "#f3f4f6" }}
        />
        <Bar dataKey="sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
