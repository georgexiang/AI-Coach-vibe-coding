import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDryRunStatus, useCancelDryRun } from "@/hooks/use-dry-runs";
import { cn } from "@/lib/utils";

interface DryRunProgressProps {
  skillId: string;
  runId: string;
  onCompleted: () => void;
  onCancel: () => void;
}

export function DryRunProgress({
  skillId,
  runId,
  onCompleted,
  onCancel,
}: DryRunProgressProps) {
  const { t } = useTranslation("skill");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [hasNotified, setHasNotified] = useState(false);

  const { data: statusData } = useDryRunStatus(skillId, runId, true);
  const cancelMutation = useCancelDryRun();

  // Handle status transitions
  useEffect(() => {
    if (!statusData || hasNotified) return;

    if (statusData.status === "completed") {
      setHasNotified(true);
      toast.success(
        t("dryRun.toastCompleted", {
          defaultValue:
            "Dry Run completed. View the report for details.",
        }),
      );
      onCompleted();
    } else if (statusData.status === "cancelled") {
      setHasNotified(true);
      toast.info(
        t("dryRun.toastCancelled", {
          defaultValue: "Dry Run cancelled.",
        }),
      );
      onCancel();
    }
  }, [statusData, hasNotified, onCompleted, onCancel, t]);

  const handleCancel = () => {
    cancelMutation.mutate(
      { skillId, runId },
      {
        onSuccess: () => {
          setCancelDialogOpen(false);
        },
        onError: () => {
          toast.error(
            t("dryRun.errorCancelFailed", {
              defaultValue: "Failed to cancel simulation",
            }),
          );
        },
      },
    );
  };

  const isFailed = statusData?.status === "failed";
  const coveragePercent = statusData?.coverage_percent ?? 0;
  const coveredSteps = statusData?.covered_sop_steps ?? 0;
  const totalSteps = statusData?.total_sop_steps ?? 0;

  return (
    <>
      <div
        className="rounded-lg border bg-card p-6 space-y-4"
        aria-live="polite"
        role="status"
      >
        {isFailed ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  {t("dryRun.errorRunFailed", {
                    defaultValue:
                      "Simulation failed. Please check the SOP content and try again.",
                  })}
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <Button variant="outline" onClick={onCancel}>
                {t("dryRun.goBack")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-primary" />
              <h3 className="text-base font-semibold">
                {t("dryRun.progressSimulating", {
                  defaultValue: "Simulating conversation...",
                })}
              </h3>
            </div>

            <p className="text-sm text-muted-foreground">
              {t("dryRun.progressStep", {
                current: coveredSteps,
                total: totalSteps,
                defaultValue: `Step ${coveredSteps} of ${totalSteps} SOP steps covered`,
              })}
            </p>

            <Progress
              value={coveragePercent}
              className={cn("h-3", "[&>div]:transition-all")}
            />

            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setCancelDialogOpen(true)}
                disabled={cancelMutation.isPending}
              >
                {t("dryRun.cancelButton", {
                  defaultValue: "Cancel Run",
                })}
              </Button>
            </div>
          </>
        )}
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("dryRun.cancelTitle", {
                defaultValue: "Cancel Simulation?",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("dryRun.cancelConfirm", {
                defaultValue:
                  "Cancel this simulation? Progress will be lost.",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              {t("dryRun.goBack")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {t("dryRun.confirmCancel", {
                defaultValue: "Cancel Run",
              })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
