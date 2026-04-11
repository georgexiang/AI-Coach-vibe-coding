import { useTranslation } from "react-i18next";
import { AlertTriangle, ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Skill, QualityEvaluation } from "@/types/skill";

/** Map backend snake_case dimension names to i18n keys */
const DIMENSION_I18N_MAP: Record<string, string> = {
  sop_completeness: "sopCompleteness",
  assessment_coverage: "assessmentCoverage",
  knowledge_accuracy: "knowledgeAccuracy",
  difficulty_calibration: "difficultyBalance",
  conversation_logic: "dialogLogic",
  executability: "executability",
};

interface PublishGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: Skill;
  evaluation: QualityEvaluation | null;
  structurePassed: boolean | null;
  isStale: boolean;
  onPublish: () => void;
  onCancel: () => void;
}

export function PublishGateDialog({
  open,
  onOpenChange,
  skill,
  evaluation,
  structurePassed,
  isStale,
  onPublish,
  onCancel,
}: PublishGateDialogProps) {
  const { t } = useTranslation("skill");

  // ----- Staleness check first -----
  if (isStale) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editor.publishSkill")}</DialogTitle>
            <DialogDescription>
              {t("confirm.staleEvaluation")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-lg border border-weakness/30 bg-weakness/5 p-4">
            <Clock className="mt-0.5 size-5 shrink-0 text-weakness" />
            <p className="text-sm text-foreground">
              {t("quality.staleWarning", {
                defaultValue:
                  "Quality evaluation is outdated -- content has changed since last assessment. Please re-run quality review before publishing.",
              })}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              {t("quality.close", { defaultValue: "Close" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ----- L1 check -----
  if (structurePassed === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editor.publishSkill")}</DialogTitle>
            <DialogDescription>
              {t("quality.l1NotRun", {
                defaultValue:
                  "Structure check has not been run. Run it first.",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              {t("quality.close", { defaultValue: "Close" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!structurePassed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editor.publishSkill")}</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm text-foreground">
              {t("quality.l1Fail", { reason: skill.structure_check_details })}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              {t("quality.close", { defaultValue: "Close" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ----- L2 check -----
  const score = evaluation?.overall_score ?? null;

  if (score === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editor.publishSkill")}</DialogTitle>
            <DialogDescription>
              {t("quality.l2NotRun", {
                defaultValue:
                  "Quality assessment has not been run. Please request a quality review first.",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              {t("quality.close", { defaultValue: "Close" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // L2 < 50: blocked
  if (score < 50) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editor.publishSkill")}</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm text-foreground">
              {t("confirm.publishBlock", { score })}
            </p>
          </div>
          {evaluation?.dimensions && (
            <LowDimensionList dimensions={evaluation.dimensions} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              {t("quality.close", { defaultValue: "Close" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // L2 50-69: warning
  if (score < 70) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editor.publishSkill")}</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-lg border border-weakness/30 bg-weakness/5 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-weakness" />
            <p className="text-sm text-foreground">
              {t("confirm.publishWarning", { score })}
            </p>
          </div>
          {evaluation?.dimensions && (
            <LowDimensionList dimensions={evaluation.dimensions} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              {t("quality.returnToEdit", { defaultValue: "Return to Edit" })}
            </Button>
            <Button variant="default" onClick={onPublish}>
              {t("quality.publishAnyway", { defaultValue: "Publish Anyway" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // L2 >= 70: success
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editor.publishSkill")}</DialogTitle>
          <DialogDescription>
            {t("quality.publishReady", {
              defaultValue:
                "Quality checks passed. The skill is ready to be published.",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg border border-strength/30 bg-strength/5 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-strength" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("quality.overallScore")}: {score}/100
            </p>
            <p className="text-sm text-muted-foreground">
              {t("quality.allChecksPassed", {
                defaultValue:
                  "All quality checks passed. You can safely publish this skill.",
              })}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("quality.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button variant="default" onClick={onPublish}>
            {t("editor.publishSkill")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helper: list dimensions scoring below 70
// ---------------------------------------------------------------------------

function LowDimensionList({
  dimensions,
}: {
  dimensions: { name: string; score: number }[];
}) {
  const { t } = useTranslation("skill");
  const lowDims = dimensions.filter((d) => d.score < 70);
  if (lowDims.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">
        {t("quality.lowDimensions", {
          defaultValue: "Dimensions needing improvement:",
        })}
      </p>
      <ul className="space-y-0.5 pl-4">
        {lowDims.map((dim) => {
          const i18nKey = DIMENSION_I18N_MAP[dim.name] ?? dim.name;
          return (
            <li key={dim.name} className="text-sm text-foreground list-disc">
              {t(`quality.dimensions.${i18nKey}`, { defaultValue: dim.name })}:{" "}
              <span
                className={cn(
                  "font-medium",
                  dim.score < 50 ? "text-destructive" : "text-weakness",
                )}
              >
                {dim.score}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
