import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * Derives a normalised volume level (0-1) from an AnalyserNode ref.
 *
 * Reads frequency data via requestAnimationFrame but only triggers a React
 * re-render when the quantised level changes (stepped to ~20 levels). This
 * keeps the AudioOrb visually smooth while avoiding 60fps re-renders of the
 * entire parent component tree.
 *
 * @param analyserRef - Ref to the AnalyserNode (from useAudioHandler)
 * @param active - Only run the RAF loop when true (e.g. session is active)
 */
export function useVolumeLevel(
  analyserRef: RefObject<AnalyserNode | null>,
  active: boolean,
): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }

    const tick = () => {
      const analyser = analyserRef.current;
      if (analyser) {
        // Reuse buffer to avoid allocation per frame
        if (!bufferRef.current || bufferRef.current.length !== analyser.frequencyBinCount) {
          bufferRef.current = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(bufferRef.current);

        let sum = 0;
        for (let i = 0; i < bufferRef.current.length; i++) {
          sum += bufferRef.current[i]!;
        }
        const raw = Math.min(1, sum / bufferRef.current.length / 128);

        // Quantise to ~20 steps (0.05 increments) to reduce React re-renders.
        // Visual smoothness is provided by CSS transition-duration on the orb.
        const quantised = Math.round(raw * 20) / 20;

        setLevel((prev) => (prev === quantised ? prev : quantised));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [analyserRef, active]);

  return level;
}
