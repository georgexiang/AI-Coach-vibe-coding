import { TrendingUp, AlertCircle, Target } from "lucide-react";

export default function FocusAreasCard() {
  return (
    <div className="space-y-6">
      {/* Top Strength */}
      <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-green-900 mb-1">
            Top Strength
          </div>
          <div className="text-sm text-green-700">
            Communication Skills
          </div>
          <div className="text-lg font-semibold text-green-600 mt-1">
            85%
          </div>
        </div>
      </div>

      {/* Needs Work */}
      <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-orange-900 mb-1">
            Needs Work
          </div>
          <div className="text-sm text-orange-700">
            Scientific Information
          </div>
          <div className="text-lg font-semibold text-orange-600 mt-1">
            68%
          </div>
        </div>
      </div>

      {/* Recommended */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Target className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-blue-900 mb-1">
            Recommended
          </div>
          <div className="text-sm text-blue-700">
            Focus on evidence-based responses in next 3 sessions
          </div>
        </div>
      </div>
    </div>
  );
}
