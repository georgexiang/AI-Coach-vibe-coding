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
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/50"
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
            ? "bg-blue-100 text-blue-700"
            : "bg-purple-100 text-purple-700",
        )}
      >
        {mode}
      </Badge>

      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p
            className={cn(
              "text-sm font-semibold",
              score >= 80
                ? "text-strength"
                : score >= 60
                  ? "text-foreground"
                  : "text-destructive",
            )}
          >
            {score}
          </p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </button>
  );
}
