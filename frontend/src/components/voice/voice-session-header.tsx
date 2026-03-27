import { useTranslation } from "react-i18next";
import { Square, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Button } from "@/components/ui";
import { SessionTimer } from "@/components/coach/session-timer";
import { ConnectionStatus } from "./connection-status";
import type { SessionMode, VoiceConnectionState } from "@/types/voice-live";

interface VoiceSessionHeaderProps {
  scenarioTitle: string;
  mode: SessionMode;
  connectionState: VoiceConnectionState;
  onEndSession: () => void;
  startedAt: string | null;
  isFullScreen?: boolean;
  onToggleView?: () => void;
}

/**
 * Session header bar for voice coaching sessions.
 * Height: 64px, matching existing coaching session header.
 * Left: SessionTimer + scenario title. Center: Mode badge. Right: Connection status, view toggle, end session.
 */
export function VoiceSessionHeader({
  scenarioTitle,
  mode,
  connectionState,
  onEndSession,
  startedAt,
  isFullScreen = false,
  onToggleView,
}: VoiceSessionHeaderProps) {
  const { t } = useTranslation("voice");

  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center justify-between border-b px-4",
        isFullScreen
          ? "border-white/10 bg-black/50 text-white"
          : "border-slate-200 bg-white",
      )}
    >
      {/* Left: Timer + Title */}
      <div className="flex items-center gap-4">
        <SessionTimer startedAt={startedAt} />
        <span
          className={cn(
            "text-sm font-medium truncate max-w-[200px]",
            isFullScreen ? "text-white" : "text-foreground",
          )}
        >
          {scenarioTitle}
        </span>
      </div>

      {/* Center: Mode badge */}
      <div className="flex items-center">
        <Badge variant="secondary" className="text-xs">
          {t(`modeBadge.${mode}`)}
        </Badge>
      </div>

      {/* Right: Connection + View toggle + End session */}
      <div className="flex items-center gap-3">
        <ConnectionStatus state={connectionState} />

        {onToggleView && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleView}
            aria-label={isFullScreen ? t("embeddedView") : t("fullScreen")}
          >
            {isFullScreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        )}

        <Button
          variant="destructive"
          size="sm"
          onClick={onEndSession}
          data-testid="end-session-btn"
        >
          <Square className="mr-1.5 h-3.5 w-3.5" />
          {t("endSession")}
        </Button>
      </div>
    </header>
  );
}
