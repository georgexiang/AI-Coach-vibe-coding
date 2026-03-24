import { ChevronRight } from "lucide-react";

interface SessionItemProps {
  hcpName: string;
  specialty: string;
  mode: "F2F" | "Conference";
  score: number;
  timeAgo: string;
  avatar: string;
}

export function SessionItem({ hcpName, specialty, mode, score, timeAgo, avatar }: SessionItemProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 60) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
  };

  const modeBadgeColor = mode === "F2F" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700";

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer group">
      <img 
        src={avatar} 
        alt={hcpName}
        className="w-12 h-12 rounded-full object-cover"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-gray-900">{hcpName}</h4>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${modeBadgeColor}`}>
            {mode}
          </span>
        </div>
        <p className="text-sm text-gray-600">{specialty}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className={`text-lg font-bold px-3 py-1 rounded-lg ${getScoreColor(score)}`}>
          {score}
        </div>
        <div className="text-sm text-gray-500 min-w-[100px] text-right">
          {timeAgo}
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
      </div>
    </div>
  );
}
