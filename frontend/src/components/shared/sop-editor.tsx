import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SopEditorProps {
  content: string;
  onChange: (content: string) => void;
  onAiRegenerate: (feedback: string) => Promise<void>;
  isRegenerating?: boolean;
  readOnly?: boolean;
  highlighted?: boolean;
}

export function SopEditor({
  content,
  onChange,
  onAiRegenerate,
  isRegenerating = false,
  readOnly = false,
  highlighted = false,
}: SopEditorProps) {
  const { t } = useTranslation("skill");
  const [feedback, setFeedback] = useState("");

  const handleApplyChanges = useCallback(async () => {
    if (!feedback.trim() || isRegenerating) return;
    try {
      await onAiRegenerate(feedback.trim());
      setFeedback("");
    } catch {
      // Error handled by parent via mutation
    }
  }, [feedback, isRegenerating, onAiRegenerate]);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr] transition-colors duration-[1500ms]",
        highlighted && "bg-primary/5 rounded-lg p-4",
      )}
    >
      {/* Left column: Editor + AI feedback */}
      <div className="flex flex-col gap-4">
        {/* Markdown editor */}
        <Textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={t("editor.sopPlaceholder", {
            defaultValue: "Write your SOP content in Markdown...",
          })}
          className="min-h-[500px] font-mono text-sm resize-y"
        />

        {/* AI feedback section */}
        {!readOnly && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <label className="text-sm font-medium text-foreground">
              <Sparkles className="mr-1.5 inline size-4 text-primary" />
              {t("editor.aiFeedbackLabel", {
                defaultValue: "AI-Assisted Editing",
              })}
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={isRegenerating}
              placeholder={t("editor.aiFeedbackPlaceholder", {
                defaultValue:
                  "Describe changes you want to make to the SOP...",
              })}
              className="min-h-[80px] text-sm"
            />
            <Button
              onClick={handleApplyChanges}
              disabled={!feedback.trim() || isRegenerating}
              size="sm"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("editor.regenerating", {
                    defaultValue: "Regenerating...",
                  })}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" />
                  {t("actions.applyChanges")}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Right column: Live Markdown preview */}
      <div className="flex flex-col rounded-lg border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium text-muted-foreground">
            {t("editor.preview", { defaultValue: "Preview" })}
          </span>
        </div>
        <ScrollArea className="h-[560px]">
          <div className="prose prose-sm max-w-none p-4 dark:prose-invert">
            {content ? (
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                {content}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">
                {t("editor.previewEmpty", {
                  defaultValue: "Start writing to see the preview...",
                })}
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
