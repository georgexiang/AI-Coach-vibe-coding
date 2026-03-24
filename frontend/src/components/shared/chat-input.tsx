import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, MicOff, Send } from "lucide-react";
import {
  Button,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
  inputMode: "text" | "audio";
  onMicClick: () => void;
  recordingState: "idle" | "recording" | "processing";
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  inputMode,
  onMicClick,
  recordingState,
  disabled = false,
}: ChatInputProps) {
  const { t } = useTranslation("training");
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setMessage("");
    textareaRef.current?.focus();
  }, [message, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const canSend = message.trim().length > 0 && inputMode === "text";

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("typeMessage")}
          disabled={disabled || inputMode === "audio"}
          className="min-h-[44px] max-h-32 resize-none"
          rows={1}
        />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "h-11 w-11 shrink-0",
                  recordingState === "recording" &&
                    "border-destructive text-destructive animate-pulse",
                  recordingState === "idle" && "text-primary",
                  recordingState === "processing" && "text-weakness",
                )}
                onClick={onMicClick}
                disabled={disabled}
                aria-label={
                  recordingState === "recording"
                    ? t("ariaStopRecording")
                    : t("ariaStartRecording")
                }
              >
                {recordingState === "recording" ? (
                  <MicOff className="size-5" />
                ) : (
                  <Mic className="size-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {recordingState === "recording"
                ? t("ariaStopRecording")
                : t("ariaStartRecording")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={handleSend}
                disabled={disabled || !canSend}
                aria-label={t("ariaSendMessage")}
              >
                <Send className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("ariaSendMessage")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-1 rounded-full bg-muted p-1">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            inputMode === "text"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => inputMode !== "text" && onMicClick()}
        >
          {t("textMode")}
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            inputMode === "audio"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => inputMode !== "audio" && onMicClick()}
        >
          {t("audioMode")}
        </button>
      </div>
    </div>
  );
}
