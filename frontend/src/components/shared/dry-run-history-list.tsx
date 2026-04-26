import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useDryRuns } from "@/hooks/use-dry-runs";
import { cn } from "@/lib/utils";
import type { DryRunListItem } from "@/types/dry-run";

// Lazy-load comparison chart (may be created by parallel executor)
const DryRunComparisonChart = lazy(
  () => import("@/components/shared/dry-run-comparison-chart").then(
    (mod) => ({ default: mod.DryRunComparisonChart }),
  ),
);

interface DryRunHistoryListProps {
  skillId: string;
  onRunClick: (runId: string) => void;
}

function getScoreBadgeVariant(
  score: number | null,
): "default" | "success" | "destructive" | "secondary" {
  if (score === null) return "secondary";
  if (score >= 70) return "success";
  if (score >= 40) return "default";
  return "destructive";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DryRunHistoryList({
  skillId,
  onRunClick,
}: DryRunHistoryListProps) {
  const { t } = useTranslation("skill");
  const { data, isLoading } = useDryRuns(skillId, {
    page: 1,
    page_size: 5,
  });

  const runs = data?.items ?? [];

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Separator />
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  // Empty state
  if (runs.length === 0) {
    return (
      <div className="space-y-4 pt-4">
        <Separator />
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-muted/50 py-12 text-center">
          <FlaskConical className="size-8 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground">
            {t("dryRun.emptyTitle", {
              defaultValue: "No Dry Runs yet",
            })}
          </h4>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("dryRun.emptyBody", {
              defaultValue:
                "Run a simulation to validate your Skill's SOP before publishing.",
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <Separator />

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">
          {t("dryRun.historyTitle", {
            defaultValue: "Dry Run History",
          })}
        </h3>
      </div>

      {/* History items */}
      <div className="rounded-lg border border-border">
        {runs.map((item: DryRunListItem, idx: number) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-muted/50",
              idx < runs.length - 1 && "border-b border-border",
            )}
            onClick={() => onRunClick(item.id)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                {t("dryRun.run", {
                  number: item.run_number,
                  defaultValue: `Run #${item.run_number}`,
                })}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(item.created_at)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {item.executability_score !== null && (
                <Badge variant={getScoreBadgeVariant(item.executability_score)}>
                  {item.executability_score}
                </Badge>
              )}
              {item.coverage_percent !== null && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {item.coverage_percent}%
                </span>
              )}
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {/* Comparison chart when >= 2 runs */}
      {runs.length >= 2 && (
        <Suspense fallback={<Skeleton className="h-[200px] w-full" />}>
          <DryRunComparisonChart
            runs={runs}
            onRunClick={onRunClick}
          />
        </Suspense>
      )}
    </div>
  );
}
