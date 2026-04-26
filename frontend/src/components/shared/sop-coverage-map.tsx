import { useTranslation } from "react-i18next";
import { Check, AlertTriangle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SopStepCoverage, CoverageStatus } from "@/types/dry-run";

interface SopCoverageMapProps {
  coverage: SopStepCoverage[];
  onStepClick?: (stepId: string) => void;
}

function statusIcon(status: CoverageStatus) {
  switch (status) {
    case "covered":
      return <Check className="size-4 text-strength" />;
    case "partial":
      return <AlertTriangle className="size-4 text-weakness" />;
    case "not_covered":
      return <X className="size-4 text-destructive" />;
  }
}

function statusBadgeVariant(
  status: CoverageStatus,
): "success" | "outline" | "destructive" {
  switch (status) {
    case "covered":
      return "success";
    case "partial":
      return "outline";
    case "not_covered":
      return "destructive";
  }
}

function statusLabel(
  status: CoverageStatus,
  t: (key: string, opts?: Record<string, string>) => string,
): string {
  switch (status) {
    case "covered":
      return t("dryRun.stepCovered", { defaultValue: "Covered" });
    case "partial":
      return t("dryRun.stepPartial", { defaultValue: "Partial" });
    case "not_covered":
      return t("dryRun.stepNotCovered", { defaultValue: "Not Covered" });
  }
}

export function SopCoverageMap({
  coverage,
  onStepClick,
}: SopCoverageMapProps) {
  const { t } = useTranslation("skill");

  if (coverage.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">
          {t("dryRun.noSopSteps", {
            defaultValue: "No SOP steps detected in skill content",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {coverage.map((step) => (
        <button
          key={step.step_id}
          type="button"
          role="button"
          aria-expanded={false}
          className={cn(
            "flex h-[28px] w-full cursor-pointer items-center gap-2 px-3 transition-colors hover:bg-muted/50",
          )}
          onClick={() => onStepClick?.(step.step_id)}
        >
          <span className="w-16 shrink-0 font-mono text-sm text-muted-foreground">
            {step.step_id}
          </span>
          <span className="flex-1 truncate text-left text-sm">
            {step.step_name}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {statusIcon(step.status)}
            <Badge
              variant={statusBadgeVariant(step.status)}
              className="text-xs"
            >
              {statusLabel(step.status, t)}
            </Badge>
          </div>
        </button>
      ))}
    </div>
  );
}
