/**
 * Audio recorder hook using MediaRecorder API (D-06).
 *
 * Records session audio in parallel with the voice input pipeline.
 * Uses stream.clone() to avoid interference with AudioWorklet.
 * Supports pause/resume for mode switches (D-04).
 *
 * Format: audio/webm;codecs=opus (browser-native, small size).
 * Falls back gracefully if MediaRecorder not supported.
 */
import { useCallback, useRef, useState } from "react";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // seconds
  hasData: boolean;
}

export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    hasData: false,
  });

  const startRecording = useCallback(
    async (existingStream?: MediaStream): Promise<boolean> => {
      try {
        // Use cloned stream if provided, otherwise request new one
        const stream = existingStream
          ? existingStream.clone()
          : await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mimeType = MediaRecorder.isTypeSupported(
          "audio/webm;codecs=opus",
        )
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(10000); // 10s chunks for reliability
        mediaRecorderRef.current = recorder;
        setState({
          isRecording: true,
          isPaused: false,
          duration: 0,
          hasData: false,
        });
        return true;
      } catch {
        // Mic permission denied or MediaRecorder not supported (D-08)
        return false;
      }
    },
    [],
  );

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setState((s) => ({ ...s, isPaused: true }));
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setState((s) => ({ ...s, isPaused: false }));
    }
  }, []);

  const stopAndGetBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: "audio/webm" })
            : null,
        );
        return;
      }
      recorder.onstop = () => {
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: "audio/webm" })
            : null;
        // Cleanup
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setState({
          isRecording: false,
          isPaused: false,
          duration: 0,
          hasData: blob !== null,
        });
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  const reset = useCallback(() => {
    chunksRef.current = [];
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      hasData: false,
    });
  }, []);

  return {
    state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopAndGetBlob,
    reset,
  };
}
