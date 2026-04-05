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

function parseJsonArray<T>(val: T[] | string | undefined): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

export function FeedbackCard({ detail }: FeedbackCardProps) {
  const { t } = useTranslation("scoring");
  const strengths = parseJsonArray(detail.strengths);
  const weaknesses = parseJsonArray(detail.weaknesses);
  const suggestions = parseJsonArray<string>(detail.suggestions);

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
        {strengths.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-green-600">
              <Check className="h-4 w-4" />
              {t("strengths")}
            </h4>
            <ul className="space-y-2">
              {strengths.map((s, idx) => (
                <li key={idx} className="text-sm text-foreground">
                  {s.text}
                  {s.quote && (
                    <p className="mt-1 text-sm italic text-muted-foreground">
                      &ldquo;{s.quote}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas to improve */}
        {weaknesses.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-orange-600">
              <X className="h-4 w-4" />
              {t("areasToImprove")}
            </h4>
            <ul className="space-y-2">
              {weaknesses.map((w, idx) => (
                <li key={idx} className="text-sm text-foreground">
                  {w.text}
                  {w.quote && (
                    <p className="mt-1 text-sm italic text-muted-foreground">
                      &ldquo;{w.quote}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-purple-600">
              <Lightbulb className="h-4 w-4" />
              {t("suggestions")}
            </h4>
            <ul className="list-disc space-y-1 pl-5">
              {suggestions.map((s, idx) => (
                <li key={idx} className="text-sm text-foreground">
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
