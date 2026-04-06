import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { AudioState } from "@/types/voice-live";

interface AudioOrbProps {
  audioState: AudioState;
  className?: string;
}

/**
 * Get status label key for the current audio state.
 */
function getStatusLabel(audioState: AudioState): string {
  switch (audioState) {
    case "listening":
      return "listening";
    case "speaking":
      return "speaking";
    case "muted":
      return "muted";
    default:
      return "idle";
  }
}

/**
 * Animated audio orb visualization for voice-only mode.
 *
 * Renders a pulsating sphere with concentric ripple effects,
 * matching AI Foundry's listening/speaking animation style.
 *
 * Uses pure CSS animations for performance (no JS RAF loop).
 * The orb appearance changes based on audioState:
 * - idle: gentle breathing pulse, subtle glow
 * - listening: active ripple rings expanding outward, bright purple glow
 * - speaking: pulsating with color shift to green, wave effect
 * - muted: dimmed, no animation
 *
 * Status label is displayed prominently below the orb (larger text),
 * matching AI Foundry's "Listening..." / "Speaking..." display.
 */
export function AudioOrb({ audioState, className }: AudioOrbProps) {
  const { t } = useTranslation("voice");
  const statusLabel = getStatusLabel(audioState);
  const isActive = audioState === "listening" || audioState === "speaking";
  const isMuted = audioState === "muted";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6",
        className,
      )}
      role="img"
      aria-label={t(statusLabel)}
      data-testid="audio-orb"
    >
      {/* Orb container — single ring + sphere (AI Foundry calm style) */}
      <div className="relative flex items-center justify-center">
        {/* Single subtle ripple ring — only when active */}
        {isActive && (
          <span
            className={cn(
              "audio-orb-ripple absolute rounded-full",
              audioState === "listening"
                ? "bg-voice-listening/15"
                : "bg-voice-speaking/15",
            )}
            data-testid="orb-ripple"
            style={{ width: 160, height: 160 }}
          />
        )}

        {/* Soft outer glow */}
        <span
          className={cn(
            "absolute rounded-full blur-2xl transition-all duration-700",
            audioState === "listening" && "audio-orb-glow bg-voice-listening/20",
            audioState === "speaking" && "audio-orb-glow bg-voice-speaking/20",
            audioState === "idle" && "audio-orb-breathe bg-voice-listening/10",
            isMuted && "bg-voice-muted/5",
          )}
          style={{ width: 140, height: 140 }}
        />

        {/* Main orb sphere */}
        <div
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full transition-all duration-700",
            audioState === "listening" &&
              "audio-orb-pulse bg-gradient-to-br from-voice-listening via-[#7C3AED] to-[#6D28D9] shadow-[0_0_40px_rgba(168,85,247,0.3)]",
            audioState === "speaking" &&
              "audio-orb-pulse bg-gradient-to-br from-voice-speaking via-[#16A34A] to-[#15803D] shadow-[0_0_40px_rgba(34,197,94,0.3)]",
            audioState === "idle" &&
              "audio-orb-breathe bg-gradient-to-br from-voice-listening/80 via-[#7C3AED]/70 to-[#6D28D9]/60 shadow-[0_0_20px_rgba(168,85,247,0.15)]",
            isMuted &&
              "bg-gradient-to-br from-voice-muted via-[#475569] to-[#334155] shadow-none",
          )}
          data-testid="orb-sphere"
          style={{ width: 100, height: 100 }}
        >
          {/* Inner highlight for glass effect */}
          <span
            className={cn(
              "absolute top-2.5 left-3.5 h-8 w-8 rounded-full transition-opacity duration-700",
              isMuted ? "bg-white/5" : "bg-white/15",
            )}
          />

          {/* Center dot */}
          <span
            className={cn(
              "h-3 w-3 rounded-full transition-all duration-500",
              audioState === "listening" && "bg-white audio-orb-center-pulse",
              audioState === "speaking" && "bg-white audio-orb-center-pulse",
              audioState === "idle" && "bg-white/50",
              isMuted && "bg-white/20",
            )}
          />
        </div>
      </div>

      {/* Status label — prominent display matching AI Foundry */}
      <p
        className={cn(
          "text-base font-medium tracking-wide transition-colors duration-300",
          audioState === "listening" && "text-voice-listening",
          audioState === "speaking" && "text-voice-speaking",
          audioState === "idle" && "text-white/50",
          isMuted && "text-white/30",
        )}
        data-testid="orb-status-label"
      >
        {t(statusLabel)}
      </p>
    </div>
  );
}
