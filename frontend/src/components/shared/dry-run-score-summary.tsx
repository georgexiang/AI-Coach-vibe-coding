import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { CoverageRingChart } from "@/components/shared/coverage-ring-chart";
import { cn } from "@/lib/utils";

interface DryRunScoreSummaryProps {
  score: number | null;
  coveragePercent: number | null;
  coveredSteps: number;
  totalSteps: number;
  issuesCount: number;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-strength";
  if (score >= 50) return "text-weakness";
  return "text-destructive";
}

export function DryRunScoreSummary({
  score,
  coveragePercent,
  coveredSteps,
  totalSteps,
  issuesCount,
}: DryRunScoreSummaryProps) {
  const { t } = useTranslation("skill");

  const isScoreEvaluated = score !== null;
  const isCoverageEvaluated = coveragePercent !== null;
  const displayScore = score ?? 0;
  const displayCoverage = coveragePercent ?? 0;
  const notEvaluatedLabel = t("dryRun.notEvaluated", {
    defaultValue: "Not evaluated",
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Score card */}
      <Card
        className="min-w-[140px]"
        aria-label={
          t("dryRun.scoreLabel", {
            defaultValue: "Executability Score",
          }) +
          ` ${isScoreEvaluated ? `${displayScore} out of 100` : notEvaluatedLabel}`
        }
      >
        <CardContent className="flex flex-col items-center p-6">
          <span className="text-sm font-semibold text-muted-foreground">
            {t("dryRun.scoreLabel")}
          </span>
          <span
            className={cn(
              "mt-2 text-4xl font-semibold",
              isScoreEvaluated
                ? scoreColor(displayScore)
                : "text-muted-foreground",
            )}
          >
            {isScoreEvaluated ? displayScore : "--"}
          </span>
          <span className="text-sm text-muted-foreground">
            {isScoreEvaluated ? "/100" : notEvaluatedLabel}
          </span>
        </CardContent>
      </Card>

      {/* Coverage card */}
      <Card
        className="min-w-[140px]"
        aria-label={
          t("dryRun.coverageLabel", {
            defaultValue: "SOP Coverage",
          }) +
          ` ${
            isCoverageEvaluated
              ? `${displayCoverage} percent, ${coveredSteps} of ${totalSteps} steps`
              : notEvaluatedLabel
          }`
        }
      >
        <CardContent className="flex flex-col items-center p-6">
          <span className="text-sm font-semibold text-muted-foreground">
            {t("dryRun.coverageLabel")}
          </span>
          <div className="mt-2">
            {isCoverageEvaluated ? (
              <CoverageRingChart
                percent={displayCoverage}
                covered={coveredSteps}
                total={totalSteps}
                size={64}
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full border text-xl font-semibold text-muted-foreground">
                --
              </div>
            )}
          </div>
          <span className="mt-1 text-sm text-muted-foreground">
            {isCoverageEvaluated
              ? `${coveredSteps}/${totalSteps}`
              : notEvaluatedLabel}
          </span>
        </CardContent>
      </Card>

      {/* Issues card */}
      <Card
        className="min-w-[140px]"
        aria-label={t("dryRun.issuesLabel", {
          defaultValue: "Issues Found",
        }) + ` ${issuesCount}`}
      >
        <CardContent className="flex flex-col items-center p-6">
          <span className="text-sm font-semibold text-muted-foreground">
            {t("dryRun.issuesLabel")}
          </span>
          <span className="mt-2 text-4xl font-semibold text-foreground">
            {issuesCount}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("dryRun.warnings")}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
