import { useCallback, useRef } from "react";

/**
 * Audio playback hook for Azure Voice Live response audio.
 *
 * Decodes base64-encoded PCM16 audio chunks (24kHz mono) from
 * `response.audio.delta` events and plays them back via Web Audio API
 * with gapless scheduling.
 *
 * Pattern matches the reference implementation (useAudioPlayer.ts):
 *   base64 → Uint8Array → Int16Array → Float32Array → AudioBufferSourceNode
 */
export function useAudioPlayer() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);

  /** Decode base64 PCM16 and schedule for gapless playback. */
  const playAudio = useCallback((base64Audio: string) => {
    // Lazily create AudioContext at 24kHz (matching Azure Voice Live sample rate)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const audioCtx = audioCtxRef.current;

    // Resume if suspended (browser autoplay policy)
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }

    // Decode: base64 → bytes → Int16 PCM → Float32 normalized [-1, 1]
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = (int16[i] ?? 0) / 32768;
    }

    // Create AudioBuffer and schedule for gapless playback
    const buffer = audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);

    // Schedule: each chunk starts when the previous ends
    nextPlayTimeRef.current = Math.max(
      nextPlayTimeRef.current,
      audioCtx.currentTime,
    );
    src.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buffer.duration;
  }, []);

  /** Stop all pending audio and reset the schedule. */
  const stopAudio = useCallback(() => {
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    nextPlayTimeRef.current = 0;
  }, []);

  return { playAudio, stopAudio };
}
