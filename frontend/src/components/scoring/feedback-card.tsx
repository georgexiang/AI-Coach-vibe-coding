import { useTranslation } from "react-i18next";
import { Check, X, Lightbulb } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ScoreDetail } from "@/types/score";

interface FeedbackCardProps {
  detail: ScoreDetail;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-orange-600";
  return "text-red-600";
}

export function FeedbackCard({ detail }: FeedbackCardProps) {
  const { t } = useTranslation("scoring");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{detail.dimension}</CardTitle>
          <span className={cn("text-lg font-semibold", getScoreColor(detail.score))}>
            {detail.score}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Strengths */}
        {detail.strengths.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-green-600">
              <Check className="h-4 w-4" />
              {t("strengths")}
            </h4>
            <ul className="space-y-2">
              {detail.strengths.map((s, idx) => (
                <li key={idx} className="text-sm text-slate-700">
                  {s.text}
                  {s.quote && (
                    <p className="mt-1 text-sm italic text-slate-500">
                      &ldquo;{s.quote}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas to improve */}
        {detail.weaknesses.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-orange-600">
              <X className="h-4 w-4" />
              {t("areasToImprove")}
            </h4>
            <ul className="space-y-2">
              {detail.weaknesses.map((w, idx) => (
                <li key={idx} className="text-sm text-slate-700">
                  {w.text}
                  {w.quote && (
                    <p className="mt-1 text-sm italic text-slate-500">
                      &ldquo;{w.quote}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggestions */}
        {detail.suggestions.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-purple-600">
              <Lightbulb className="h-4 w-4" />
              {t("suggestions")}
            </h4>
            <ul className="list-disc space-y-1 pl-5">
              {detail.suggestions.map((s, idx) => (
                <li key={idx} className="text-sm text-slate-700">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
