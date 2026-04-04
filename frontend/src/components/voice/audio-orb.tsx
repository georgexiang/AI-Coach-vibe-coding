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
      {/* Orb container - holds the sphere and ripple rings */}
      <div className="relative flex items-center justify-center">
        {/* Ripple rings - only visible when active */}
        {isActive && (
          <>
            <span
              className={cn(
                "audio-orb-ripple absolute rounded-full",
                audioState === "listening"
                  ? "bg-[#A855F7]/20"
                  : "bg-[#22C55E]/20",
              )}
              data-testid="orb-ripple"
              style={{
                width: 180,
                height: 180,
                animationDelay: "0s",
              }}
            />
            <span
              className={cn(
                "audio-orb-ripple absolute rounded-full",
                audioState === "listening"
                  ? "bg-[#A855F7]/15"
                  : "bg-[#22C55E]/15",
              )}
              style={{
                width: 220,
                height: 220,
                animationDelay: "0.4s",
              }}
            />
            <span
              className={cn(
                "audio-orb-ripple absolute rounded-full",
                audioState === "listening"
                  ? "bg-[#A855F7]/10"
                  : "bg-[#22C55E]/10",
              )}
              style={{
                width: 260,
                height: 260,
                animationDelay: "0.8s",
              }}
            />
          </>
        )}

        {/* Outer glow */}
        <span
          className={cn(
            "absolute rounded-full blur-xl transition-all duration-500",
            audioState === "listening" && "audio-orb-glow bg-[#A855F7]/30",
            audioState === "speaking" && "audio-orb-glow bg-[#22C55E]/30",
            audioState === "idle" && "audio-orb-breathe bg-[#A855F7]/15",
            isMuted && "bg-[#64748B]/10",
          )}
          style={{ width: 140, height: 140 }}
        />

        {/* Main orb sphere — larger to match AI Foundry */}
        <div
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full transition-all duration-500",
            audioState === "listening" &&
              "audio-orb-pulse bg-gradient-to-br from-[#A855F7] via-[#7C3AED] to-[#6D28D9] shadow-[0_0_60px_rgba(168,85,247,0.5)]",
            audioState === "speaking" &&
              "audio-orb-pulse bg-gradient-to-br from-[#22C55E] via-[#16A34A] to-[#15803D] shadow-[0_0_60px_rgba(34,197,94,0.5)]",
            audioState === "idle" &&
              "audio-orb-breathe bg-gradient-to-br from-[#A855F7]/80 via-[#7C3AED]/70 to-[#6D28D9]/60 shadow-[0_0_30px_rgba(168,85,247,0.25)]",
            isMuted &&
              "bg-gradient-to-br from-[#64748B] via-[#475569] to-[#334155] shadow-none",
          )}
          data-testid="orb-sphere"
          style={{ width: 120, height: 120 }}
        >
          {/* Inner highlight for glass effect */}
          <span
            className={cn(
              "absolute top-3 left-4 h-10 w-10 rounded-full transition-opacity duration-500",
              isMuted ? "bg-white/5" : "bg-white/20",
            )}
          />

          {/* Center icon/indicator */}
          <span
            className={cn(
              "h-4 w-4 rounded-full transition-all duration-300",
              audioState === "listening" && "bg-white audio-orb-center-pulse",
              audioState === "speaking" && "bg-white audio-orb-center-pulse",
              audioState === "idle" && "bg-white/60",
              isMuted && "bg-white/30",
            )}
          />
        </div>
      </div>

      {/* Status label — prominent display matching AI Foundry */}
      <p
        className={cn(
          "text-base font-medium tracking-wide transition-colors duration-300",
          audioState === "listening" && "text-[#A855F7]",
          audioState === "speaking" && "text-[#22C55E]",
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
