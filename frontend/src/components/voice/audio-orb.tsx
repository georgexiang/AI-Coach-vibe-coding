import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { AudioState } from "@/types/voice-live";

interface AudioOrbProps {
  audioState: AudioState;
  /** Normalised volume level 0–1, drives real-time pulsation scale. */
  volumeLevel?: number;
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
export function AudioOrb({ audioState, volumeLevel = 0, className }: AudioOrbProps) {
  const { t } = useTranslation("voice");
  const statusLabel = getStatusLabel(audioState);
  const isActive = audioState === "listening" || audioState === "speaking";
  const isMuted = audioState === "muted";

  // Clamp volume to 0–1, derive dynamic scale for real-time pulsation
  const vol = Math.min(1, Math.max(0, volumeLevel));
  const sphereScale = isActive ? 1 + vol * 0.18 : 1;
  const rippleSize = 220 + vol * 60; // 220–280px based on volume
  const glowSize = 200 + vol * 40;   // 200–240px based on volume

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
      {/* Orb container — enlarged for prominence, volume-reactive sizing */}
      <div className="relative flex items-center justify-center">
        {/* Ripple ring — volume-reactive size */}
        {isActive && (
          <span
            className={cn(
              "audio-orb-ripple absolute rounded-full transition-[width,height] duration-150",
              audioState === "listening"
                ? "bg-voice-listening/15"
                : "bg-voice-speaking/15",
            )}
            data-testid="orb-ripple"
            style={{ width: rippleSize, height: rippleSize }}
          />
        )}

        {/* Soft outer glow — volume-reactive */}
        <span
          className={cn(
            "absolute rounded-full blur-2xl transition-all duration-150",
            audioState === "listening" && "audio-orb-glow bg-voice-listening/20",
            audioState === "speaking" && "audio-orb-glow bg-voice-speaking/20",
            audioState === "idle" && "audio-orb-breathe bg-voice-listening/10",
            isMuted && "bg-voice-muted/5",
          )}
          style={{ width: glowSize, height: glowSize }}
        />

        {/* Main orb sphere — larger (160px base), CSS pulse + volume-driven scale */}
        <div
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full transition-transform duration-150",
            audioState === "listening" &&
              "audio-orb-pulse bg-gradient-to-br from-voice-listening via-[#7C3AED] to-[#6D28D9] shadow-[0_0_50px_rgba(168,85,247,0.35)]",
            audioState === "speaking" &&
              "audio-orb-pulse bg-gradient-to-br from-voice-speaking via-[#16A34A] to-[#15803D] shadow-[0_0_50px_rgba(34,197,94,0.35)]",
            audioState === "idle" &&
              "audio-orb-breathe bg-gradient-to-br from-voice-listening/80 via-[#7C3AED]/70 to-[#6D28D9]/60 shadow-[0_0_25px_rgba(168,85,247,0.15)]",
            isMuted &&
              "bg-gradient-to-br from-voice-muted via-[#475569] to-[#334155] shadow-none",
          )}
          data-testid="orb-sphere"
          style={{
            width: 160,
            height: 160,
            transform: `scale(${sphereScale})`,
          }}
        >
          {/* Inner highlight for glass effect */}
          <span
            className={cn(
              "absolute top-3 left-5 h-10 w-10 rounded-full transition-opacity duration-700",
              isMuted ? "bg-white/5" : "bg-white/15",
            )}
          />

          {/* Center dot — larger */}
          <span
            className={cn(
              "h-4 w-4 rounded-full transition-all duration-150",
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
