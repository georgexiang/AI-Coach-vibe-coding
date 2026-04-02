import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { SessionMode, VoiceConnectionState } from "@/types/voice-live";

interface ModeStatusIndicatorProps {
  currentMode: SessionMode;
  initialMode: SessionMode;
  connectionState: VoiceConnectionState;
  className?: string;
}

/**
 * Persistent mode status badge component (D-12, UI-SPEC I-09, L-04).
 * Shows green dot when at optimal mode, amber when degraded, red when disconnected.
 * Replaces the static Badge in VoiceSessionHeader.
 */
export function ModeStatusIndicator({
  currentMode,
  initialMode,
  connectionState,
  className,
}: ModeStatusIndicatorProps) {
  const { t } = useTranslation("voice");

  const isDegraded = currentMode !== initialMode;
  const isDisconnected =
    connectionState === "disconnected" || connectionState === "error";

  const dotColor = isDisconnected
    ? "bg-destructive"
    : isDegraded
      ? "bg-amber-500"
      : "bg-green-500";

  const statusText = isDisconnected
    ? t("modeStatus.disconnected")
    : isDegraded
      ? t("modeStatus.degraded")
      : t("modeStatus.connected");

  return (
    <Badge
      variant="outline"
      className={cn("flex items-center gap-2 text-xs font-semibold", className)}
      role="status"
      aria-live="polite"
    >
      <span className={cn("size-2 shrink-0 rounded-full", dotColor)} />
      {t(`modeBadge.${currentMode}`)} - {statusText}
    </Badge>
  );
}
