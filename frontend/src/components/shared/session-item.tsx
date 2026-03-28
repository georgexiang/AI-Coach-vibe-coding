import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

interface SessionItemProps {
  hcpName: string;
  specialty: string;
  mode: "F2F" | "Conference";
  score: number;
  timeAgo: string;
  avatar?: string;
  onClick?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SessionItem({
  hcpName,
  specialty,
  mode,
  score,
  timeAgo,
  avatar,
  onClick,
}: SessionItemProps) {
  const { t } = useTranslation("common");
  const modeLabel = mode === "F2F" ? t("modeF2F") : t("modeConference");
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors duration-150 hover:bg-muted/50"
      onClick={onClick}
    >
      <Avatar className="size-10">
        {avatar ? <AvatarImage src={avatar} alt={hcpName} /> : null}
        <AvatarFallback className="bg-primary/10 text-sm text-primary">
          {getInitials(hcpName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{hcpName}</p>
        <p className="truncate text-sm text-muted-foreground">{specialty}</p>
      </div>

      <Badge
        className={cn(
          "shrink-0",
          mode === "F2F"
            ? "bg-primary/10 text-primary"
            : "bg-improvement/10 text-improvement",
        )}
      >
        {modeLabel}
      </Badge>

      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <div
            className={cn(
              "rounded-md px-2 py-0.5",
              score >= 80
                ? "bg-strength/10 text-strength"
                : score >= 60
                  ? "bg-chart-3/10 text-chart-3"
                  : "bg-destructive/10 text-destructive",
            )}
          >
            <p className="text-sm font-medium">
              {score}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </button>
  );
}
