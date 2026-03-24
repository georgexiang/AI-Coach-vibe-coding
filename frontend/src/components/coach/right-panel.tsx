import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ScrollArea,
  Separator,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui";
import { StatusBadge } from "@/components/shared";

interface CoachHint {
  id: string;
  text: string;
}

interface MessageStatus {
  id: string;
  label: string;
  status: "delivered" | "in-progress" | "pending";
}

interface RightPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  hints: CoachHint[];
  messageStatuses: MessageStatus[];
  sessionTime: string;
  wordCount: number;
}

export function RightPanel({
  isCollapsed,
  onToggleCollapse,
  hints,
  messageStatuses,
  sessionTime,
  wordCount,
}: RightPanelProps) {
  const { t } = useTranslation("training");

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
                onClick={onToggleCollapse}
                aria-label={t("ariaExpandRight")}
              >
                <ChevronLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {t("ariaExpandRight")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[260px] flex-col border-l bg-muted">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("coachingPanel")}
        </h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onToggleCollapse}
                aria-label={t("ariaCollapseRight")}
              >
                <ChevronRight className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("ariaCollapseRight")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-4">
        {/* AI Coach Hints */}
        <div className="space-y-1 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("aiCoachHints")}
          </h3>
          <ul className="space-y-2 pt-2">
            {hints.map((hint) => (
              <li key={hint.id} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">
                  {hint.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* Message Tracker */}
        <div className="space-y-1 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("messageTracker")}
          </h3>
          <div className="space-y-2 pt-2">
            {messageStatuses.map((msg) => (
              <StatusBadge
                key={msg.id}
                status={msg.status}
                label={msg.label}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* Session Stats */}
        <div className="space-y-1 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("sessionStats")}
          </h3>
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("duration")}
              </span>
              <span className="text-xs font-medium text-foreground">
                {sessionTime}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("wordCount")}
              </span>
              <span className="text-xs font-medium text-foreground">
                {wordCount}
              </span>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
