import { useState } from "react";
import { Calendar, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

// Mock data for charts
const groupPerformanceData = [
  { name: "Oncology", avgScore: 82 },
  { name: "Hematology", avgScore: 75 },
  { name: "Immunology", avgScore: 88 },
];

const scoreTrendsData = [
  { week: "Week 1", score: 68 },
  { week: "Week 2", score: 70 },
  { week: "Week 3", score: 72 },
  { week: "Week 4", score: 74 },
  { week: "Week 5", score: 76 },
  { week: "Week 6", score: 77 },
  { week: "Week 7", score: 79 },
  { week: "Week 8", score: 80 },
  { week: "Week 9", score: 81 },
  { week: "Week 10", score: 82 },
  { week: "Week 11", score: 83 },
  { week: "Week 12", score: 84 },
];

const completionRatesData = [
  { region: "North China", rate: 85 },
  { region: "East China", rate: 72 },
  { region: "South China", rate: 68 },
  { region: "West China", rate: 91 },
];

const skillGapData = [
  {
    dimension: "Product Knowledge",
    Oncology: 85,
    Hematology: 78,
    Immunology: 90,
  },
  {
    dimension: "Clinical Understanding",
    Oncology: 80,
    Hematology: 72,
    Immunology: 88,
  },
  {
    dimension: "Communication Skills",
    Oncology: 75,
    Hematology: 82,
    Immunology: 85,
  },
  {
    dimension: "Objection Handling",
    Oncology: 78,
    Hematology: 68,
    Immunology: 82,
  },
  {
    dimension: "Compliance Knowledge",
    Oncology: 88,
    Hematology: 85,
    Immunology: 92,
  },
];

export default function OrganizationReports() {
  const [selectedBU, setSelectedBU] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState("all");

  const getPerformanceColor = (score: number) => {
    if (score >= 85) return "#10b981"; // green
    if (score >= 75) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 85) return "#10b981";
    if (rate >= 75) return "#f59e0b";
    return "#ef4444";
  };

  const getSkillColor = (score: number) => {
    if (score >= 85) return "#10b981";
    if (score >= 75) return "#fbbf24";
    if (score >= 65) return "#fb923c";
    return "#ef4444";
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Organization Analytics</h1>

        {/* Filters */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
          <Select value={selectedBU} onValueChange={setSelectedBU}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Business Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Business Units</SelectItem>
              <SelectItem value="oncology">Oncology</SelectItem>
              <SelectItem value="hematology">Hematology</SelectItem>
              <SelectItem value="immunology">Immunology</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="north">North China</SelectItem>
              <SelectItem value="east">East China</SelectItem>
              <SelectItem value="south">South China</SelectItem>
              <SelectItem value="west">West China</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="pd1">PD-1 Inhibitor</SelectItem>
              <SelectItem value="btk">BTK Inhibitor</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700">Last 12 Weeks</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Group Performance */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={groupPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="avgScore" name="Average Score" radius={[4, 4, 0, 0]}>
                {groupPerformanceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getPerformanceColor(entry.avgScore)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Score Trends */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scoreTrendsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[60, 90]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="score"
                name="Organization Average"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
              />
              <Line
                type="monotone"
                dataKey={() => 75}
                name="Benchmark"
                stroke="#6b7280"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Completion Rates */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Completion Rates by Region</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={completionRatesData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="region" width={100} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="rate" name="Completion Rate %" radius={[0, 4, 4, 0]}>
                {completionRatesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getCompletionColor(entry.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Skill Gap Analysis */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Skill Gap Analysis</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                    Dimension
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">
                    Oncology
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">
                    Hematology
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">
                    Immunology
                  </th>
                </tr>
              </thead>
              <tbody>
                {skillGapData.map((row) => (
                  <tr key={row.dimension} className="border-b border-gray-100">
                    <td className="py-3 px-3 text-sm text-gray-900">{row.dimension}</td>
                    <td className="py-3 px-3">
                      <div
                        className="text-center py-1 px-2 rounded text-sm font-medium text-white"
                        style={{ backgroundColor: getSkillColor(row.Oncology) }}
                      >
                        {row.Oncology}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div
                        className="text-center py-1 px-2 rounded text-sm font-medium text-white"
                        style={{ backgroundColor: getSkillColor(row.Hematology) }}
                      >
                        {row.Hematology}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div
                        className="text-center py-1 px-2 rounded text-sm font-medium text-white"
                        style={{ backgroundColor: getSkillColor(row.Immunology) }}
                      >
                        {row.Immunology}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" className="border-gray-300">
          <Download className="w-4 h-4 mr-2" />
          Export PDF Report
        </Button>
        <Button variant="outline" className="border-gray-300">
          <Download className="w-4 h-4 mr-2" />
          Export Excel Data
        </Button>
      </div>
    </div>
  );
}
