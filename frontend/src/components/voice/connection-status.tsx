import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { VoiceConnectionState } from "@/types/voice-live";

interface ConnectionStatusProps {
  state: VoiceConnectionState;
  className?: string;
}

function getDotColor(state: VoiceConnectionState): string {
  switch (state) {
    case "connecting":
    case "reconnecting":
      return "bg-[#F97316]";
    case "connected":
      return "bg-[#22C55E]";
    case "disconnected":
    case "error":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}

function getTextColor(state: VoiceConnectionState): string {
  switch (state) {
    case "connecting":
    case "reconnecting":
      return "text-[#F97316]";
    case "connected":
      return "text-[#22C55E]";
    case "disconnected":
    case "error":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Connection state indicator.
 * Shows colored dot (8px circle) + text per connection state.
 * Uses aria-live="assertive" for screen reader announcements.
 */
export function ConnectionStatus({
  state,
  className,
}: ConnectionStatusProps) {
  const { t } = useTranslation("voice");

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      aria-live="assertive"
      role="status"
    >
      <span
        className={cn("inline-block h-2 w-2 rounded-full", getDotColor(state))}
        data-testid="status-dot"
      />
      <span className={cn("text-sm", getTextColor(state))}>
        {t(`status.${state}`)}
      </span>
    </div>
  );
}
