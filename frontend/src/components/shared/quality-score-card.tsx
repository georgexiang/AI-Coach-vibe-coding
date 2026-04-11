import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check, AlertTriangle, XCircle } from "lucide-react";
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

interface QualityScoreCardProps {
  dimension: QualityDimension;
  isExpanded?: boolean;
  onToggle?: () => void;
}

function scoreColor(score: number): string {
  if (score >= 70) return "bg-strength";
  if (score >= 50) return "bg-weakness";
  return "bg-destructive";
}

function scoreTrackColor(score: number): string {
  if (score >= 70) return "bg-strength/20";
  if (score >= 50) return "bg-weakness/20";
  return "bg-destructive/20";
}

function scoreBadgeColor(score: number): string {
  if (score >= 70) return "bg-strength/10 text-strength";
  if (score >= 50) return "bg-weakness/10 text-weakness";
  return "bg-destructive/10 text-destructive";
}

export function QualityScoreCard({
  dimension,
  isExpanded: controlledExpanded,
  onToggle,
}: QualityScoreCardProps) {
  const { t } = useTranslation("skill");
  const [internalExpanded, setInternalExpanded] = useState(false);

  const isExpanded = controlledExpanded ?? internalExpanded;
  const handleToggle = onToggle ?? (() => setInternalExpanded((prev) => !prev));

  const i18nKey = DIMENSION_I18N_MAP[dimension.name] ?? dimension.name;
  const label = t(`quality.dimensions.${i18nKey}`, {
    defaultValue: dimension.name,
  });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header - clickable to expand/collapse */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">
            {label}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
              scoreBadgeColor(dimension.score),
            )}
          >
            {dimension.score}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className={cn("h-2 w-full rounded-full", scoreTrackColor(dimension.score))}>
          <div
            className={cn(
              "h-full rounded-full transition-all",
              scoreColor(dimension.score),
            )}
            style={{ width: `${Math.min(dimension.score, 100)}%` }}
          />
        </div>
      </div>

      {/* Expandable details */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {/* Rationale */}
          {dimension.rationale && (
            <p className="text-sm italic text-muted-foreground">
              {dimension.rationale}
            </p>
          )}

          {/* Strengths */}
          {dimension.strengths.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-strength">
                <Check className="size-3.5" />
                {t("quality.strengths", { defaultValue: "Strengths" })}
              </div>
              <ul className="space-y-0.5 pl-5">
                {dimension.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-foreground list-disc">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {dimension.improvements.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-weakness">
                <AlertTriangle className="size-3.5" />
                {t("quality.improvements", { defaultValue: "Improvements" })}
              </div>
              <ul className="space-y-0.5 pl-5">
                {dimension.improvements.map((s, i) => (
                  <li key={i} className="text-sm text-foreground list-disc">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Critical Issues */}
          {dimension.critical_issues.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <XCircle className="size-3.5" />
                {t("quality.criticalIssues", {
                  defaultValue: "Critical Issues",
                })}
              </div>
              <ul className="space-y-0.5 pl-5">
                {dimension.critical_issues.map((s, i) => (
                  <li key={i} className="text-sm text-foreground list-disc">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
