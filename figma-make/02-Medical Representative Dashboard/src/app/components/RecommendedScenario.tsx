import { Target } from "lucide-react";

interface RecommendedScenarioProps {
  hcpName: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
}

export function RecommendedScenario({ hcpName, difficulty }: RecommendedScenarioProps) {
  const difficultyColors = {
    Beginner: "bg-green-100 text-green-700",
    Intermediate: "bg-orange-100 text-orange-700",
    Advanced: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Target className="w-5 h-5 text-amber-600" />
        </div>
        
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 mb-1">Recommended Scenario</h4>
          <p className="text-sm text-gray-600 mb-2">Practice with {hcpName}</p>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${difficultyColors[difficulty]}`}>
            {difficulty}
          </span>
        </div>
      </div>
    </div>
  );
}
