import { useTranslation } from "react-i18next";
import { Square, Maximize2, Minimize2, MessageSquareText, Mic, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui";
import { SessionTimer } from "@/components/coach/session-timer";
import { ConnectionStatus } from "./connection-status";
import { ModeStatusIndicator } from "./mode-status-indicator";
import type { SessionMode, VoiceConnectionState } from "@/types/voice-live";

/** Modes available for in-session switching (user-facing subset). */
const SESSION_SWITCH_MODES: { value: SessionMode; icon: typeof MessageSquareText; labelKey: string }[] = [
  { value: "text", icon: MessageSquareText, labelKey: "mode.text" },
  { value: "voice_realtime_model", icon: Mic, labelKey: "mode.voice_realtime_model" },
];

interface VoiceSessionHeaderProps {
  scenarioTitle: string;
  currentMode: SessionMode;
  initialMode: SessionMode;
  connectionState: VoiceConnectionState;
  onEndSession: () => void;
  startedAt: string | null;
  isFullScreen?: boolean;
  onToggleView?: () => void;
  /** Callback for in-session mode switching. If not provided, mode switch UI is hidden. */
  onModeChange?: (mode: SessionMode) => void;
  /** Modes available for switching (filtered by feature flags). If not provided, mode switch UI is hidden. */
  availableModes?: SessionMode[];
}

/**
 * Session header bar for voice coaching sessions.
 * Height: 64px, matching existing coaching session header.
 * Left: SessionTimer + scenario title. Center: ModeStatusIndicator. Right: Connection status, view toggle, end session.
 */
export function VoiceSessionHeader({
  scenarioTitle,
  currentMode,
  initialMode,
  connectionState,
  onEndSession,
  startedAt,
  isFullScreen = false,
  onToggleView,
  onModeChange,
  availableModes,
}: VoiceSessionHeaderProps) {
  const { t } = useTranslation("voice");

  // Determine if mode switching is enabled
  const canSwitchMode = onModeChange && availableModes && availableModes.length > 1;

  // Filter session switch modes by available modes
  const switchableModes = canSwitchMode
    ? SESSION_SWITCH_MODES.filter((m) => availableModes.includes(m.value))
    : [];

  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center justify-between border-b px-4",
        isFullScreen
          ? "border-white/10 bg-black/50 text-white"
          : "border-border bg-card",
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

      {/* Center: Mode status indicator — clickable dropdown if switching is available */}
      <div className="flex items-center">
        {canSwitchMode ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-accent"
                data-testid="mode-switch-trigger"
              >
                <ModeStatusIndicator
                  currentMode={currentMode}
                  initialMode={initialMode}
                  connectionState={connectionState}
                />
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuLabel>{t("switchMode")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={currentMode}
                onValueChange={(value) => onModeChange(value as SessionMode)}
              >
                {switchableModes.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <DropdownMenuRadioItem
                      key={mode.value}
                      value={mode.value}
                      disabled={mode.value === currentMode}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {t(mode.labelKey)}
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <ModeStatusIndicator
            currentMode={currentMode}
            initialMode={initialMode}
            connectionState={connectionState}
          />
        )}
      </div>

      {/* Right: Connection + View toggle + End session */}
      <div className="flex items-center gap-3">
        {currentMode !== "text" && <ConnectionStatus state={connectionState} />}

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
