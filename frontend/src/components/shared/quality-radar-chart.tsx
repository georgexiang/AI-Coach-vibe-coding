import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { cn } from "@/lib/utils";
import type { QualityDimension } from "@/types/skill";

/** Map backend snake_case dimension names to i18n keys */
const DIMENSION_I18N_MAP: Record<string, string> = {
  sop_completeness: "sopCompleteness",
  assessment_coverage: "assessmentCoverage",
  knowledge_accuracy: "knowledgeAccuracy",
  difficulty_calibration: "difficultyBalance",
  conversation_logic: "dialogLogic",
  executability: "executability",
};

interface QualityRadarChartProps {
  dimensions: QualityDimension[];
  overallScore?: number;
  overallVerdict?: string;
}

export function QualityRadarChart({
  dimensions,
  overallScore,
  overallVerdict,
}: QualityRadarChartProps) {
  const { t } = useTranslation("skill");

  const chartData = dimensions.map((dim) => {
    const i18nKey = DIMENSION_I18N_MAP[dim.name] ?? dim.name;
    return {
      dimension: t(`quality.dimensions.${i18nKey}`, { defaultValue: dim.name }),
      score: dim.score,
      fullMark: 100,
    };
  });

  const verdictColor =
    overallVerdict === "PASS"
      ? "text-strength"
      : overallVerdict === "NEEDS_REVIEW"
        ? "text-weakness"
        : "text-destructive";

  const verdictLabel =
    overallVerdict === "PASS"
      ? t("quality.verdictPass", { defaultValue: "Pass" })
      : overallVerdict === "NEEDS_REVIEW"
        ? t("quality.verdictNeedsReview", { defaultValue: "Needs Review" })
        : t("quality.verdictFail", { defaultValue: "Fail" });

  return (
    <div
      aria-label={`Quality assessment: overall score ${overallScore ?? 0} out of 100`}
    >
      <ResponsiveContainer width="100%" height={300}>
        <RechartsRadarChart data={chartData}>
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "#64748B", fontSize: 12 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} />
          <Radar
            name="Score"
            dataKey="score"
            stroke="var(--primary, #1E40AF)"
            fill="var(--primary, #1E40AF)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>

      {overallScore != null && (
        <div className="mt-4 flex flex-col items-center gap-1">
          <span className="text-4xl font-semibold text-foreground">
            {overallScore}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("quality.overallScore")} / 100
          </span>
          {overallVerdict && (
            <span className={cn("text-sm font-medium", verdictColor)}>
              {verdictLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
