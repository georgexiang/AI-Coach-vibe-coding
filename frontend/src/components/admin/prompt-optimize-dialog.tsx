import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOptimizeText } from "@/hooks/use-prompts";
import type { OptimizeMode } from "@/types/prompt";

interface PromptOptimizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current prompt text to optimize and diff against. */
  content: string;
  /** Called with the optimized text when the admin adopts the result. */
  onAdopt: (optimizedText: string) => void;
  defaultMode?: OptimizeMode;
}

/**
 * Reusable optimize + diff + adopt dialog shared by every prompt editor
 * (global registry, scoring rubric, conference audience). It uses the stateless
 * POST /prompts/optimize endpoint so it never mutates the prompt registry — the
 * parent decides what to do with the adopted text via `onAdopt`.
 */
export function PromptOptimizeDialog({
  open,
  onOpenChange,
  content,
  onAdopt,
  defaultMode = "system",
}: PromptOptimizeDialogProps) {
  const { t } = useTranslation("prompts");
  const optimizeMutation = useOptimizeText();
  const [mode, setMode] = useState<OptimizeMode>(defaultMode);
  const [requirements, setRequirements] = useState("");
  const [optimized, setOptimized] = useState<string | null>(null);

  const reset = () => {
    setMode(defaultMode);
    setRequirements("");
    setOptimized(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleOptimize = () => {
    optimizeMutation.mutate(
      {
        prompt: content,
        mode,
        requirements: mode === "iterate" ? requirements : null,
      },
      {
        onSuccess: (res) => setOptimized(res.optimized_prompt),
        onError: () => toast.error(t("optimize.failed")),
      },
    );
  };

  const handleAdopt = () => {
    if (optimized === null) return;
    onAdopt(optimized);
    toast.success(t("optimize.adopted"));
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("optimize.title")}</DialogTitle>
          <DialogDescription>{t("optimize.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("optimize.mode")}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as OptimizeMode)}>
              <SelectTrigger className="w-full" data-testid="optimize-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t("optimize.modeSystem")}</SelectItem>
                <SelectItem value="user">{t("optimize.modeUser")}</SelectItem>
                <SelectItem value="iterate">{t("optimize.modeIterate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "iterate" && (
            <div className="space-y-2">
              <Label htmlFor="optimize-requirements">{t("optimize.requirements")}</Label>
              <Textarea
                id="optimize-requirements"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder={t("optimize.requirementsPlaceholder")}
                rows={3}
              />
            </div>
          )}

          {optimized !== null && (
            <div className="grid grid-cols-2 gap-4" data-testid="optimize-diff">
              <div className="space-y-1">
                <Label>{t("optimize.original")}</Label>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
                  {content}
                </pre>
              </div>
              <div className="space-y-1">
                <Label>{t("optimize.optimized")}</Label>
                <pre
                  className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-success-50 p-3 text-xs"
                  data-testid="optimized-text"
                >
                  {optimized}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("optimize.cancel")}
          </Button>
          {optimized !== null ? (
            <Button onClick={handleAdopt} data-testid="adopt-run">
              {t("optimize.adopt")}
            </Button>
          ) : (
            <Button
              onClick={handleOptimize}
              disabled={
                optimizeMutation.isPending || (mode === "iterate" && !requirements.trim())
              }
              data-testid="run-optimize"
            >
              <Sparkles className="size-4" />
              {optimizeMutation.isPending ? t("optimize.running") : t("optimize.run")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
