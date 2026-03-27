import { useTranslation } from "react-i18next";
import {
  Mic,
  MicOff,
  Volume2,
  Keyboard,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui";
import type { AudioState, VoiceConnectionState } from "@/types/voice-live";

interface VoiceControlsProps {
  audioState: AudioState;
  connectionState: VoiceConnectionState;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleKeyboard: () => void;
  onToggleView?: () => void;
  isFullScreen?: boolean;
  className?: string;
}

function getMicButtonConfig(
  audioState: AudioState,
  connectionState: VoiceConnectionState,
  isMuted: boolean,
) {
  if (connectionState === "connecting" || connectionState === "reconnecting") {
    return {
      icon: Loader2,
      colorClass: "bg-muted text-muted-foreground",
      animateClass: "animate-spin",
      ariaKey: "micButton.connecting" as const,
      disabled: true,
      pulse: false,
    };
  }

  if (connectionState !== "connected") {
    return {
      icon: Mic,
      colorClass: "bg-muted text-muted-foreground opacity-50",
      animateClass: "",
      ariaKey: "micButton.disabled" as const,
      disabled: true,
      pulse: false,
    };
  }

  if (isMuted) {
    return {
      icon: MicOff,
      colorClass: "bg-muted-foreground text-white",
      animateClass: "",
      ariaKey: "micButton.muted" as const,
      disabled: false,
      pulse: false,
    };
  }

  switch (audioState) {
    case "listening":
      return {
        icon: Mic,
        colorClass: "bg-[#22C55E] text-white",
        animateClass: "",
        ariaKey: "micButton.listening" as const,
        disabled: false,
        pulse: true,
      };
    case "speaking":
      return {
        icon: Volume2,
        colorClass: "bg-[#F97316] text-white",
        animateClass: "",
        ariaKey: "micButton.speaking" as const,
        disabled: false,
        pulse: false,
      };
    default:
      return {
        icon: Mic,
        colorClass: "bg-primary text-primary-foreground",
        animateClass: "",
        ariaKey: "micButton.idle" as const,
        disabled: false,
        pulse: false,
      };
  }
}

/**
 * Mic button and control bar.
 * Centered 56px mic button with state-dependent colors and animations.
 * Side buttons for mute toggle, keyboard input, and view mode toggle.
 */
export function VoiceControls({
  audioState,
  connectionState,
  isMuted,
  onToggleMute,
  onToggleKeyboard,
  onToggleView,
  isFullScreen = false,
  className,
}: VoiceControlsProps) {
  const { t } = useTranslation("voice");
  const config = getMicButtonConfig(audioState, connectionState, isMuted);
  const MicIcon = config.icon;

  return (
    <div
      className={cn(
        "flex h-16 items-center justify-center gap-4",
        className,
      )}
    >
      {/* Mute toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onToggleMute}
            disabled={connectionState !== "connected"}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
              "hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed",
            )}
            aria-label={isMuted ? t("unmute") : t("mute")}
          >
            {isMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{isMuted ? t("unmute") : t("mute")}</TooltipContent>
      </Tooltip>

      {/* Central mic button */}
      <div className="relative">
        {config.pulse && (
          <span
            className="absolute inset-0 rounded-full bg-[#22C55E] animate-ping opacity-30"
            style={{ animationDuration: "1.5s" }}
          />
        )}
        <button
          type="button"
          onClick={onToggleMute}
          disabled={config.disabled}
          className={cn(
            "relative z-10 flex h-14 w-14 items-center justify-center rounded-full transition-all",
            "disabled:cursor-not-allowed",
            config.colorClass,
          )}
          aria-label={t(config.ariaKey)}
          data-testid="mic-button"
        >
          <MicIcon className={cn("h-6 w-6", config.animateClass)} />
        </button>
      </div>

      {/* Keyboard input toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onToggleKeyboard}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
              "hover:bg-accent",
            )}
            aria-label={t("keyboardInput")}
          >
            <Keyboard className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("keyboardInput")}</TooltipContent>
      </Tooltip>

      {/* View mode toggle */}
      {onToggleView && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleView}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                "hover:bg-accent",
              )}
              aria-label={isFullScreen ? t("embeddedView") : t("fullScreen")}
            >
              {isFullScreen ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {isFullScreen ? t("embeddedView") : t("fullScreen")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
