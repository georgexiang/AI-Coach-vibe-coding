import { useTranslation } from "react-i18next";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ScoreSummaryProps {
  overallScore: number;
  passed: boolean;
  trend?: number;
}

function getGrade(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "excellent", color: "bg-green-100 text-green-700" };
  if (score >= 60) return { label: "good", color: "bg-orange-100 text-orange-700" };
  return { label: "needsImprovement", color: "bg-red-100 text-red-700" };
}

export function ScoreSummary({ overallScore, passed, trend }: ScoreSummaryProps) {
  const { t } = useTranslation("scoring");
  const grade = getGrade(overallScore);

  return (
    <div className="flex items-center gap-6">
      <span className="text-3xl font-semibold">{overallScore}</span>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-sm", grade.color)}>
            {t(`grades.${grade.label}`)}
          </Badge>
          <Badge className={cn("text-sm", passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
            {passed ? "PASS" : "FAIL"}
          </Badge>
        </div>

        {trend != null && trend !== 0 && (
          <div
            className={cn(
              "flex items-center gap-1 text-sm",
              trend > 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {trend > 0
                ? t("trendUp", { n: trend })
                : t("trendDown", { n: Math.abs(trend) })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
