import { useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { AudioState } from "@/types/voice-live";

interface WaveformVizProps {
  audioState: AudioState;
  analyserData: Uint8Array | null;
  className?: string;
}

const BAR_COUNT = 5;
const DEFAULT_HEIGHT = 0.15;

function getBarColor(audioState: AudioState): string {
  switch (audioState) {
    case "listening":
      return "bg-primary";
    case "speaking":
      return "bg-voice-speaking";
    case "idle":
      return "bg-primary opacity-30";
    case "muted":
      return "bg-muted-foreground opacity-30";
    default:
      return "bg-muted-foreground opacity-30";
  }
}

function getLabel(audioState: AudioState): string {
  switch (audioState) {
    case "listening":
      return "listening";
    case "speaking":
      return "speaking";
    default:
      return "idle";
  }
}

/**
 * Animated waveform visualization for audio-only mode.
 * Renders 5 vertical bars with heights derived from analyser frequency data.
 * Uses requestAnimationFrame-driven CSS transform for smooth 60fps animation.
 */
export function WaveformViz({
  audioState,
  analyserData,
  className,
}: WaveformVizProps) {
  const { t } = useTranslation("voice");
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const updateBars = useCallback(() => {
    const bars = barsRef.current;
    if (!bars.length) return;

    for (let i = 0; i < BAR_COUNT; i++) {
      const bar = bars[i];
      if (!bar) continue;

      let height = DEFAULT_HEIGHT;
      if (
        analyserData &&
        (audioState === "listening" || audioState === "speaking")
      ) {
        // Sample 5 evenly-spaced frequency bins
        const binIndex = Math.floor(
          (i / BAR_COUNT) * analyserData.length,
        );
        const value = analyserData[binIndex] ?? 0;
        height = Math.max(DEFAULT_HEIGHT, value / 255);
      }
      bar.style.transform = `scaleY(${height})`;
    }

    animFrameRef.current = requestAnimationFrame(updateBars);
  }, [analyserData, audioState]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(updateBars);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [updateBars]);

  const barColor = getBarColor(audioState);
  const label = getLabel(audioState);

  return (
    <div
      className={cn(
        "flex h-[120px] flex-col items-center justify-center rounded-lg bg-slate-900",
        className,
      )}
      role="img"
      aria-label={t(label)}
    >
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            data-testid="waveform-bar"
            className={cn(
              "w-2 rounded-full transition-transform duration-75 origin-bottom",
              barColor,
            )}
            style={{
              height: 64,
              transform: `scaleY(${DEFAULT_HEIGHT})`,
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-white/70">{t(label)}</p>
    </div>
  );
}
