import { useState } from "react";
import { ArrowUpDown, Eye, PlayCircle } from "lucide-react";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";

interface Session {
  id: number;
  date: string;
  scenarioName: string;
  specialty: string;
  mode: "F2F" | "Conference";
  score: number;
  dimensions: number[];
  duration: string;
}

const mockSessions: Session[] = [
  {
    id: 1,
    date: "Mar 24, 2026 10:30",
    scenarioName: "Dr. Sarah Johnson",
    specialty: "Cardiologist",
    mode: "F2F",
    score: 85,
    dimensions: [88, 82, 90, 78, 87],
    duration: "15 min",
  },
  {
    id: 2,
    date: "Mar 23, 2026 14:15",
    scenarioName: "Dr. Michael Chen",
    specialty: "Oncologist",
    mode: "Conference",
    score: 78,
    dimensions: [75, 80, 72, 76, 81],
    duration: "18 min",
  },
  {
    id: 3,
    date: "Mar 22, 2026 09:45",
    scenarioName: "Dr. Emily Rodriguez",
    specialty: "Neurologist",
    mode: "F2F",
    score: 92,
    dimensions: [95, 90, 88, 93, 94],
    duration: "12 min",
  },
  {
    id: 4,
    date: "Mar 21, 2026 16:20",
    scenarioName: "Dr. James Wilson",
    specialty: "Endocrinologist",
    mode: "F2F",
    score: 74,
    dimensions: [70, 78, 72, 75, 73],
    duration: "20 min",
  },
  {
    id: 5,
    date: "Mar 20, 2026 11:00",
    scenarioName: "Dr. Lisa Thompson",
    specialty: "Rheumatologist",
    mode: "Conference",
    score: 88,
    dimensions: [85, 90, 86, 88, 91],
    duration: "14 min",
  },
  {
    id: 6,
    date: "Mar 19, 2026 13:30",
    scenarioName: "Dr. Robert Kim",
    specialty: "Pulmonologist",
    mode: "F2F",
    score: 81,
    dimensions: [82, 79, 85, 78, 81],
    duration: "17 min",
  },
  {
    id: 7,
    date: "Mar 18, 2026 10:15",
    scenarioName: "Dr. Amanda Lee",
    specialty: "Gastroenterologist",
    mode: "Conference",
    score: 76,
    dimensions: [74, 78, 75, 77, 76],
    duration: "16 min",
  },
  {
    id: 8,
    date: "Mar 17, 2026 15:45",
    scenarioName: "Dr. David Martinez",
    specialty: "Nephrologist",
    mode: "F2F",
    score: 89,
    dimensions: [91, 88, 87, 90, 89],
    duration: "13 min",
  },
];

interface SessionTableProps {
  searchQuery: string;
}

export default function SessionTable({ searchQuery }: SessionTableProps) {
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filteredSessions = mockSessions.filter((session) =>
    session.scenarioName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600";
    if (score >= 75) return "text-orange-600";
    return "text-red-600";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("");
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                <button
                  className="flex items-center gap-1 hover:text-gray-900"
                  onClick={() =>
                    setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                  }
                >
                  Date
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Scenario
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Mode
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Score
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Dimensions
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredSessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">
                  {session.date}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                        {getInitials(session.scenarioName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {session.scenarioName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {session.specialty}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge
                    className={
                      session.mode === "F2F"
                        ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                        : "bg-purple-100 text-purple-700 hover:bg-purple-100"
                    }
                  >
                    {session.mode}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`text-lg font-semibold ${getScoreColor(
                      session.score
                    )}`}
                  >
                    {session.score}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    {session.dimensions.map((dim, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <div className="w-6 h-16 bg-gray-100 rounded relative overflow-hidden">
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded"
                            style={{ height: `${dim}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 mt-1">
                          {dim}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {session.duration}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-3">
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                      <PlayCircle className="w-4 h-4" />
                      Replay
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing 1-{filteredSessions.length} of 24 sessions
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map((page) => (
            <button
              key={page}
              className={`w-8 h-8 rounded ${
                page === 1
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
