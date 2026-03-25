import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import ScoreTrendChart from "../components/charts/ScoreTrendChart";
import DimensionRadarChart from "../components/charts/DimensionRadarChart";
import FrequencyBarChart from "../components/charts/FrequencyBarChart";
import FocusAreasCard from "../components/FocusAreasCard";

export default function PersonalReports() {
  const [activePeriod, setActivePeriod] = useState<"week" | "month" | "quarter" | "year">("month");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-gray-900">My Performance Report</h1>
      </div>

      {/* Time Period Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["week", "month", "quarter", "year"] as const).map((period) => (
          <button
            key={period}
            onClick={() => setActivePeriod(period)}
            className={`px-6 py-3 font-medium capitalize transition-colors relative ${
              activePeriod === period
                ? "text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {period}
            {activePeriod === period && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Score Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Trend</h3>
          <ScoreTrendChart />
        </div>

        {/* Dimension Comparison */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Dimension Comparison</h3>
          <DimensionRadarChart />
        </div>

        {/* Training Frequency */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Frequency</h3>
          <FrequencyBarChart />
        </div>

        {/* Focus Areas */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Focus Areas</h3>
          <FocusAreasCard />
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-3">
        <Button className="gap-2">
          <FileText className="w-4 h-4" />
          Download PDF Report
        </Button>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Download Excel Data
        </Button>
      </div>
    </div>
  );
}
