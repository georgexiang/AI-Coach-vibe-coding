import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ScrollArea,
  Checkbox,
  Separator,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface TopicGuideProps {
  topics: Array<{ message: string; delivered: boolean }>;
  scenarioName: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function TopicGuide({
  topics,
  scenarioName,
  isCollapsed,
  onToggle,
}: TopicGuideProps) {
  const { t } = useTranslation("conference");

  if (isCollapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-r bg-muted pt-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onToggle}
                aria-label={t("ariaExpandTopics")}
              >
                <ChevronRight className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t("ariaExpandTopics")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[240px] flex-col border-r bg-muted">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("topicGuide")}
        </h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onToggle}
                aria-label={t("ariaCollapseTopics")}
              >
                <ChevronLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("ariaCollapseTopics")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-4">
        {/* Scenario name */}
        <div className="space-y-1 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            {scenarioName}
          </h3>
        </div>

        <Separator />

        {/* Key Topics Checklist */}
        <div className="space-y-1 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("topicGuide")}
          </h3>
          <div className="space-y-2.5 pt-2">
            {topics.map((topic, index) => (
              <label
                key={index}
                className="flex items-start gap-2"
              >
                <Checkbox
                  checked={topic.delivered}
                  disabled
                  className="mt-0.5"
                />
                <span
                  className={cn(
                    "text-xs",
                    topic.delivered
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                >
                  {topic.message}
                </span>
              </label>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
