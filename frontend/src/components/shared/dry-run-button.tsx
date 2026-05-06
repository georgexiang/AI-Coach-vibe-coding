import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCreateDryRun } from "@/hooks/use-dry-runs";
import { cn } from "@/lib/utils";

interface DryRunButtonProps {
  skillId: string | undefined;
  hasContent: boolean;
  isNew: boolean;
  skillStatus: string;
  onDryRunCreated: (runId: string) => void;
}

export function DryRunButton({
  skillId,
  hasContent,
  isNew,
  skillStatus,
  onDryRunCreated,
}: DryRunButtonProps) {
  const { t } = useTranslation("skill");
  const [dialogOpen, setDialogOpen] = useState(false);
  const createMutation = useCreateDryRun();

  const isDisabled =
    isNew ||
    !hasContent ||
    skillStatus === "archived" ||
    skillStatus === "failed";

  const handleStartSimulation = () => {
    if (!skillId) return;
    createMutation.mutate(skillId, {
      onSuccess: (data) => {
        setDialogOpen(false);
        onDryRunCreated(data.id);
        toast.success(
          t("dryRun.toastStarted", {
            defaultValue: "Dry Run started",
          }),
        );
      },
      onError: () => {
        toast.error(
          t("dryRun.errorStartFailed", {
            defaultValue: "Failed to start simulation",
          }),
        );
      },
    });
  };

  const button = (
    <Button
      variant="outline"
      disabled={isDisabled || createMutation.isPending}
      onClick={() => setDialogOpen(true)}
      aria-disabled={isDisabled}
      className={cn(isDisabled && "cursor-not-allowed")}
    >
      <FlaskConical className="mr-2 size-4" />
      {t("dryRun.button")}
    </Button>
  );

  return (
    <>
      {isDisabled ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>{button}</span>
          </TooltipTrigger>
          <TooltipContent>
            {t("dryRun.tooltipDisabled", {
              defaultValue:
                "Save the skill content first to run a simulation.",
            })}
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("dryRun.startTitle", {
                defaultValue: "Start Dry Run Simulation",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("dryRun.startBody", {
                defaultValue:
                  "The system will simulate a complete MR-HCP training conversation using AI agents to validate this Skill's SOP. Estimated time: 1-3 minutes.",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("dryRun.goBack")}
            </Button>
            <Button
              onClick={handleStartSimulation}
              disabled={createMutation.isPending}
            >
              {t("dryRun.startButton", {
                defaultValue: "Start Simulation",
              })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
