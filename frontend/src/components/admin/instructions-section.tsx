import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import { previewInstructions } from "@/api/hcp-profiles";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";

interface InstructionsSectionProps {
  form: UseFormReturn<HcpFormValues>;
  profileId?: string;
  isNew: boolean;
  /** Called when auto-generated instructions are loaded or regenerated */
  onAutoInstructionsChange?: (instructions: string) => void;
}

export function InstructionsSection({
  form,
  profileId,
  isNew,
  onAutoInstructionsChange,
}: InstructionsSectionProps) {
  const { t } = useTranslation(["admin", "common"]);
  const [autoInstructions, setAutoInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasGenerated = useRef(false);

  // Auto-load instructions on mount for existing profiles
  useEffect(() => {
    if (isNew || !profileId) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    previewInstructions(form.getValues(), controller.signal)
      .then((result) => {
        setAutoInstructions(result.instructions);
        onAutoInstructionsChange?.(result.instructions);
        hasGenerated.current = true;
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Silently fail on mount — user can click wand to retry
      });

    return () => {
      controller.abort();
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const handleGenerate = async () => {
    // Cancel previous in-flight request (race condition guard)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);

    try {
      const result = await previewInstructions(
        form.getValues(),
        controller.signal,
      );
      setAutoInstructions(result.instructions);
      onAutoInstructionsChange?.(result.instructions);
      hasGenerated.current = true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(t("admin:hcp.instructionsError"));
    } finally {
      setIsGenerating(false);
    }
  };

  const overrideValue = form.watch("agent_instructions_override");
  const hasOverride = Boolean(overrideValue && overrideValue.trim());

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {t("admin:hcp.autoInstructions")}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="h-7 gap-1 text-xs"
          >
            <Wand2 className="size-3.5" />
            {isGenerating
              ? "..."
              : hasGenerated.current
                ? t("common:regenerate")
                : t("common:generate")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasOverride && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            {t("admin:hcp.overrideInstructions")}{" "}
            — override will be used instead of auto-generated.
          </p>
        )}

        {autoInstructions ? (
          <pre
            className="text-xs bg-muted/50 rounded p-3 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono"
            role="log"
          >
            {autoInstructions}
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("admin:hcp.instructionsHint")}
          </p>
        )}

        <FormField
          control={form.control}
          name="agent_instructions_override"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">
                {t("admin:hcp.overrideInstructions")}
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={4}
                  placeholder={t("admin:hcp.overridePlaceholder")}
                  className="text-xs font-mono"
                />
              </FormControl>
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
