import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ArrowDown } from "lucide-react";
import {
  ScrollArea,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui";
import { TranscriptionLine } from "./transcription-line";
import type { TranscriptLine } from "@/types/conference";

interface TranscriptionPanelProps {
  lines: TranscriptLine[];
  isCollapsed: boolean;
  onToggle: () => void;
  speakerMap: Map<string, number>;
}

export function TranscriptionPanel({
  lines,
  isCollapsed,
  onToggle,
  speakerMap,
}: TranscriptionPanelProps) {
  const { t } = useTranslation("conference");
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const isAutoScrolling = useRef(true);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAutoScrolling.current = isNearBottom;
    setShowJumpButton(!isNearBottom);
  }, []);

  useEffect(() => {
    if (isAutoScrolling.current) {
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines]);

  const jumpToLatest = useCallback(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    isAutoScrolling.current = true;
    setShowJumpButton(false);
  }, []);

  if (isCollapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-l bg-muted pt-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onToggle}
                aria-label={t("ariaExpandTranscript")}
              >
                <ChevronLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {t("ariaExpandTranscript")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-[280px] flex-col border-l bg-muted">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("transcription")}
        </h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onToggle}
                aria-label={t("ariaCollapseTranscript")}
              >
                <ChevronRight className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("ariaCollapseTranscript")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Content */}
      <ScrollArea
        className="flex-1 px-4"
        role="region"
        aria-live="polite"
        aria-label={t("transcription")}
      >
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="space-y-3 py-4"
        >
          {lines.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              {t("emptyTranscription")}
            </p>
          ) : (
            lines.map((line, index) => (
              <TranscriptionLine
                key={index}
                line={line}
                speakerIndex={speakerMap.get(line.speakerId ?? line.speaker) ?? 0}
              />
            ))
          )}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      {/* Jump to latest button */}
      {showJumpButton && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button
            variant="secondary"
            size="sm"
            onClick={jumpToLatest}
            className="shadow-md"
          >
            <ArrowDown className="mr-1 size-3" />
            Jump to latest
          </Button>
        </div>
      )}
    </div>
  );
}
