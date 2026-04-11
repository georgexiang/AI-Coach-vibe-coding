import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ConversionStatus } from "@/types/skill";

interface ConversionProgressProps {
  status: ConversionStatus | null;
  error?: string;
  onRetry?: () => void;
}

export function ConversionProgress({
  status,
  error,
  onRetry,
}: ConversionProgressProps) {
  const { t } = useTranslation("skill");

  if (!status) return null;

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

      {/* Processing */}
      {status === "processing" && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <Loader2 className="size-5 animate-spin text-[var(--improvement)]" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--improvement)]">
              {t("conversion.processing")}
            </p>
            <Progress className="mt-2" />
          </div>
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
