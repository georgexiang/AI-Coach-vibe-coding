import { Avatar, AvatarFallback, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AudienceHcp } from "@/types/conference";

interface AudienceCardProps {
  hcp: AudienceHcp;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AudienceCard({ hcp }: AudienceCardProps) {
  const initials = getInitials(hcp.hcpName);

  return (
    <div
      className={cn(
        "flex w-[160px] flex-col items-center gap-1.5 rounded-md border bg-card p-3 shadow-sm",
        hcp.status === "speaking" && "border-primary",
        hcp.status === "idle" && "opacity-60",
      )}
      aria-label={`${hcp.hcpName} - ${hcp.status}`}
    >
      <Avatar className="size-10">
        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium text-foreground">{hcp.hcpName}</span>
      <Badge variant="secondary" className="text-xs">
        {hcp.hcpSpecialty}
      </Badge>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          hcp.status === "listening" && "bg-green-500",
          hcp.status === "hand-raised" && "bg-orange-500 animate-pulse",
          hcp.status === "speaking" && "bg-primary",
          hcp.status === "idle" && "bg-muted-foreground opacity-60",
        )}
      />
    </div>
  );
}
