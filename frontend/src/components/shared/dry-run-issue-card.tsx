import { useTranslation } from "react-i18next";
import { AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DryRunIssue } from "@/types/dry-run";

interface DryRunIssueCardProps {
  issue: DryRunIssue;
}

export function DryRunIssueCard({ issue }: DryRunIssueCardProps) {
  const { t } = useTranslation("skill");

  const isError = issue.severity === "error";

  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 p-4",
        isError
          ? "border-l-destructive bg-destructive/5"
          : "border-l-weakness bg-weakness/5",
      )}
    >
      <div className="flex items-start gap-3">
        {isError ? (
          <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
        ) : (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-weakness" />
        )}
        <div className="space-y-1">
          {issue.step_id && (
            <p className="text-xs font-medium text-muted-foreground">
              Step: {issue.step_id}
            </p>
          )}
          <p className="text-sm text-foreground">{issue.description}</p>
          {issue.suggestion && (
            <p className="text-sm italic text-muted-foreground">
              {t("dryRun.suggestionPrefix", { defaultValue: "Suggestion:" })}{" "}
              {issue.suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
