import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertCircle, Loader2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ConversionStatus } from "@/types/skill";
import type { ConversionProgressInfo } from "@/api/skills";

interface ConversionProgressProps {
  status: ConversionStatus | null;
  error?: string;
  progress?: ConversionProgressInfo;
  onRetry?: () => void;
}

const STEP_LABELS: Record<string, string> = {
  extracting_text: "提取文本 / Extracting text",
  collecting_resources: "收集资源 / Collecting resources",
  converting_to_markdown: "转换为 Markdown",
  truncating: "文本截断 / Truncating",
  semantic_chunking: "语义分块 / Semantic chunking",
  ai_extraction: "AI 提取 SOP / AI extraction",
  merging: "合并结果 / Merging",
  formatting: "格式化协议 / Formatting protocol",
  finalizing: "完成 / Finalizing",
};

export function ConversionProgress({
  status,
  error,
  progress,
  onRetry,
}: ConversionProgressProps) {
  const { t } = useTranslation("skill");

  if (!status) return null;

  const progressPercent = progress
    ? Math.round((progress.current_step / progress.total_steps) * 100)
    : undefined;

  return (
    <div aria-live="polite" className="w-full space-y-3">
      {/* Pending */}
      {status === "pending" && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <Loader2 className="size-5 animate-spin text-[var(--improvement)]" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--improvement)]">
              {t("conversion.pending")}
            </p>
            <Progress className="mt-2" />
          </div>
        </div>
      )}

      {/* Processing — with step details */}
      {status === "processing" && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-[var(--improvement)]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--improvement)]">
                {t("conversion.processing")}
              </p>
              {progressPercent !== undefined && (
                <Progress value={progressPercent} className="mt-2" />
              )}
              {progressPercent === undefined && <Progress className="mt-2" />}
            </div>
            {progress && (
              <span className="text-xs text-muted-foreground">
                {progress.current_step}/{progress.total_steps}
              </span>
            )}
          </div>
          {/* Step list */}
          {progress?.steps && (
            <div className="ml-8 space-y-1">
              {progress.steps.map((step) => (
                <div key={step.step} className="flex items-center gap-2 text-xs">
                  {step.status === "completed" && (
                    <CheckCircle2 className="size-3.5 text-strength" />
                  )}
                  {step.status === "in_progress" && (
                    <Loader2 className="size-3.5 animate-spin text-[var(--improvement)]" />
                  )}
                  {step.status === "pending" && (
                    <Circle className="size-3.5 text-muted-foreground/40" />
                  )}
                  <span
                    className={cn(
                      step.status === "completed" && "text-strength",
                      step.status === "in_progress" && "font-medium text-[var(--improvement)]",
                      step.status === "pending" && "text-muted-foreground/60",
                    )}
                  >
                    {STEP_LABELS[step.name] ?? step.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completed */}
      {status === "completed" && (
        <div className="flex items-center gap-3 rounded-lg border border-strength/20 bg-strength/5 p-4">
          <CheckCircle2 className="size-5 text-strength" />
          <div className="flex-1">
            <Badge variant="success">{t("status.completed", { defaultValue: "Completed" })}</Badge>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("conversion.completed")}
            </p>
          </div>
        </div>
      )}

      {/* Failed */}
      {status === "failed" && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4",
          )}
        >
          <AlertCircle className="mt-0.5 size-5 text-destructive" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-destructive">
              {t("conversion.failed")}
            </p>
            {error && (
              <p className="text-xs text-destructive/80">{error}</p>
            )}
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {t("conversion.retry")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
