import { useTranslation } from "react-i18next";
import {
  Mic,
  MicOff,
  Volume2,
  Keyboard,
  Maximize2,
  Minimize2,
  Loader2,
  VideoOff,
  X,
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
  onEndSession?: () => void;
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
        colorClass: "bg-voice-speaking text-white",
        animateClass: "",
        ariaKey: "micButton.listening" as const,
        disabled: false,
        pulse: true,
      };
    case "speaking":
      return {
        icon: Volume2,
        colorClass: "bg-voice-warning text-white",
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
 * Voice session control bar — AI Foundry-style bottom controls.
 * Layout: [camera off] [mic button (large)] [end call (red)] + secondary controls.
 * Central mic button is 56px with state-dependent colors and animations.
 */
export function VoiceControls({
  audioState,
  connectionState,
  isMuted,
  onToggleMute,
  onToggleKeyboard,
  onToggleView,
  onEndSession,
  isFullScreen = false,
  className,
}: VoiceControlsProps) {
  const { t } = useTranslation("voice");
  const config = getMicButtonConfig(audioState, connectionState, isMuted);
  const MicIcon = config.icon;

  return (
    <div
      className={cn(
        "flex h-20 items-center justify-center gap-3 bg-slate-900/95 backdrop-blur-sm",
        className,
      )}
    >
      {/* Camera off button (AI Foundry style - always show as camera off since we do voice) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
              "bg-white/10 text-white/60 cursor-not-allowed",
            )}
            aria-label={t("cameraOff")}
            data-testid="camera-off-btn"
          >
            <VideoOff className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("cameraOff")}</TooltipContent>
      </Tooltip>

      {/* Central mic button */}
      <div className="relative">
        {config.pulse && (
          <span
            className="absolute inset-0 rounded-full bg-voice-speaking animate-ping opacity-30"
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

      {/* End call button (AI Foundry style red circle with X) */}
      {onEndSession && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onEndSession}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                "bg-destructive text-white hover:bg-destructive/80",
              )}
              aria-label={t("endSession")}
              data-testid="end-call-btn"
            >
              <X className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("endSession")}</TooltipContent>
        </Tooltip>
      )}

      {/* Separator */}
      <div className="mx-1 h-8 w-px bg-white/20" />

      {/* Keyboard input toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onToggleKeyboard}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
              "text-white/70 hover:bg-white/10",
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
                "text-white/70 hover:bg-white/10",
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
