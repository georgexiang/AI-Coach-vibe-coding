import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ScrollArea,
  Checkbox,
  Avatar,
  AvatarFallback,
  Badge,
  Separator,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface KeyMessage {
  id: string;
  label: string;
  checked: boolean;
}

interface ScoringCriterion {
  label: string;
  weight: number;
}

interface LeftPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  scenarioProduct: string;
  scenarioContext: string;
  hcpName: string;
  hcpSpecialty: string;
  hcpPersonality: string;
  hcpBackground: string;
  keyMessages: KeyMessage[];
  onToggleKeyMessage: (id: string) => void;
  scoringCriteria: ScoringCriterion[];
}

export function LeftPanel({
  isCollapsed,
  onToggleCollapse,
  scenarioProduct,
  scenarioContext,
  hcpName,
  hcpSpecialty,
  hcpPersonality,
  hcpBackground,
  keyMessages,
  onToggleKeyMessage,
  scoringCriteria,
}: LeftPanelProps) {
  const { t } = useTranslation("training");

  const initials = hcpName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
                onClick={onToggleCollapse}
                aria-label={t("ariaExpandLeft")}
              >
                <ChevronRight className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t("ariaExpandLeft")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[280px] flex-col border-r bg-muted">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("trainingPanel")}
        </h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onToggleCollapse}
                aria-label={t("ariaCollapseLeft")}
              >
                <ChevronLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("ariaCollapseLeft")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-1 py-4">
          {/* Scenario Briefing */}
          <h3 className="text-sm font-semibold text-foreground">
            {t("scenarioBriefing")}
          </h3>
          <div className="space-y-2 pt-2">
            <div>
              <span className="text-xs font-medium text-foreground">
                {t("product")}
              </span>
              <p className="text-xs text-muted-foreground">
                {scenarioProduct}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-foreground">
                {t("context")}
              </span>
              <p className="text-xs text-muted-foreground">
                {scenarioContext}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* HCP Profile */}
        <div className="space-y-1 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("hcpProfile")}
          </h3>
          <div className="flex items-center gap-3 pt-2">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{hcpName}</p>
              <Badge variant="secondary" className="text-xs">
                {hcpSpecialty}
              </Badge>
            </div>
          </div>
          <div className="space-y-1 pt-2">
            <div>
              <span className="text-xs font-medium text-foreground">
                {t("personality")}
              </span>
              <p className="text-xs text-muted-foreground">
                {hcpPersonality}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-foreground">
                {t("background")}
              </span>
              <p className="text-xs text-muted-foreground">{hcpBackground}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Key Messages */}
        <div className="space-y-1 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("keyMessages")}
          </h3>
          <div className="space-y-2.5 pt-2">
            {keyMessages.map((msg) => (
              <label
                key={msg.id}
                className="flex items-start gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={msg.checked}
                  onCheckedChange={() => onToggleKeyMessage(msg.id)}
                  className="mt-0.5"
                />
                <span
                  className={cn(
                    "text-xs",
                    msg.checked
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                >
                  {msg.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {/* Scoring Criteria */}
        <div className="space-y-1 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("scoringCriteria")}
          </h3>
          <div className="space-y-1.5 pt-2">
            {scoringCriteria.map((criterion) => (
              <div
                key={criterion.label}
                className="flex items-center justify-between"
              >
                <span className="text-xs text-muted-foreground">
                  {criterion.label}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {criterion.weight}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
