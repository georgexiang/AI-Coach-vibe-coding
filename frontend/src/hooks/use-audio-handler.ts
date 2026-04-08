import { useCallback, useRef, useState, useEffect } from "react";
import { createVoiceLogger } from "@/lib/voice-logger";

const log = createVoiceLogger("AudioHandler");

/**
 * Audio capture and playback hook.
 * Wraps AudioWorklet with recording/playback/waveform data.
 * Uses AudioContext with 24kHz sample rate and AnalyserNode for waveform visualization.
 *
 * NOTE: Analyser frequency data is exposed via `analyserRef` (AnalyserNode ref)
 * rather than React state to avoid 60fps re-renders of the parent component tree.
 * Consumers that need volume visualization should use `useVolumeLevel(analyserRef)`.
 */
export function useAudioHandler() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  const initialize = useCallback(async () => {
    log.info("initialize: requesting mic permission");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    log.info("initialize: mic permission acquired, tracks=%d", stream.getTracks().length);
    streamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: 24000 });
    await ctx.audioWorklet.addModule("/audio-processor.js");
    log.info("initialize: AudioWorklet loaded, sampleRate=%d", ctx.sampleRate);
    audioContextRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const workletNode = new AudioWorkletNode(ctx, "audio-recorder-processor");
    analyser.connect(workletNode);
    workletNode.connect(ctx.destination);
    workletNodeRef.current = workletNode;

    return { ctx, workletNode, analyser };
  }, []);

  const startRecording = useCallback(
    (onAudioData: (data: Float32Array) => void) => {
      if (!workletNodeRef.current) {
        log.warn("startRecording: workletNode not initialized");
        return;
      }
      log.info("startRecording");
      workletNodeRef.current.port.postMessage({ command: "START_RECORDING" });
      workletNodeRef.current.port.onmessage = (e: MessageEvent) => {
        const msg = e.data as { eventType?: string; audioData?: Float32Array };
        if (msg.eventType === "audio" && msg.audioData) {
          onAudioData(msg.audioData);
        }
      };
      setIsRecording(true);

      // Keep RAF loop alive so AnalyserNode stays connected and responsive.
      // Volume consumers read from analyserRef directly via useVolumeLevel().
      // No setState here — avoids 60fps re-renders of the parent component tree.
      const keepAlive = () => {
        animationFrameRef.current = requestAnimationFrame(keepAlive);
      };
      keepAlive();
    },
    [],
  );

  const stopRecording = useCallback(() => {
    log.info("stopRecording");
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ command: "STOP_RECORDING" });
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const cleanup = useCallback(() => {
    log.info("cleanup");
    stopRecording();
    streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    workletNodeRef.current = null;
    analyserRef.current = null;
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    initialize,
    startRecording,
    stopRecording,
    cleanup,
    isRecording,
    analyserRef,
  };
}
