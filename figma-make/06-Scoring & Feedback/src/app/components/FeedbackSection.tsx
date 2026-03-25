import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Lightbulb } from 'lucide-react';

interface FeedbackItem {
  dimension: string;
  score: number;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
}

interface FeedbackSectionProps {
  items: FeedbackItem[];
}

export function FeedbackSection({ items }: FeedbackSectionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleExpand(index)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900">{item.dimension}</span>
              <span className="text-sm text-gray-600">{item.score}%</span>
            </div>
            {expandedIndex === index ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {expandedIndex === index && (
            <div className="px-4 pb-4 space-y-4">
              {item.strengths.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">Strengths</span>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {item.strengths.map((strength, i) => (
                      <li key={i} className="text-sm text-gray-700">"{strength}"</li>
                    ))}
                  </ul>
                </div>
              )}

              {item.improvements.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-semibold text-orange-700">Areas to Improve</span>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {item.improvements.map((improvement, i) => (
                      <li key={i} className="text-sm text-gray-700">"{improvement}"</li>
                    ))}
                  </ul>
                </div>
              )}

              {item.suggestions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700">Suggestions</span>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {item.suggestions.map((suggestion, i) => (
                      <li key={i} className="text-sm text-gray-700">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
