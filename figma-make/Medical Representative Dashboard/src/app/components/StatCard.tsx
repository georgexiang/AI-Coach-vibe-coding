import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: string;
    direction: "up" | "down";
  };
  chart?: React.ReactNode;
  progress?: {
    current: number;
    total: number;
  };
  color?: "green" | "blue" | "purple";
}

export function StatCard({ label, value, icon: Icon, trend, chart, progress, color = "blue" }: StatCardProps) {
  const colorClasses = {
    green: "text-green-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`w-10 h-10 rounded-lg bg-${color === "green" ? "green" : color === "purple" ? "purple" : "blue"}-50 flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
            </div>
          )}
        </div>
        {chart}
      </div>
      
      <div className="space-y-1">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-600">{label}</div>
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1">
          <svg className={`w-4 h-4 ${trend.direction === "up" ? "text-green-600" : "text-red-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trend.direction === "up" ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
          </svg>
          <span className={`text-sm font-medium ${trend.direction === "up" ? "text-green-600" : "text-red-600"}`}>
            {trend.value}
          </span>
        </div>
      )}

      {progress && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {progress.current} of {progress.total} goal
          </div>
        </div>
      )}
    </div>
  );
}
