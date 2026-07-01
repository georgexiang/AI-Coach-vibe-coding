import { useCallback, useRef } from "react";
import { useAudioRecorder } from "./use-audio-recorder";
import { uploadSessionAudio } from "@/api/unified-session";

export interface SessionRecorderResult {
  /** Whether the recorder is currently capturing audio. */
  isRecording: boolean;
  /** Start recording from a given MediaStream. */
  startRecording: (stream: MediaStream) => Promise<boolean>;
  /** Stop recording, upload the audio blob, and return success status. */
  stopAndUpload: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  /** Stop recording without uploading (e.g., on abort). */
  cancel: () => Promise<void>;
}

/**
 * Hook that wraps useAudioRecorder with session-specific upload logic.
 *
 * Usage:
 *   1. Call `startRecording(micStream)` after audio handler initializes.
 *   2. At session end, call `stopAndUpload(sessionId)` to finalize and upload.
 *   3. If session is aborted without needing upload, call `cancel()`.
 */
export function useSessionRecorder(): SessionRecorderResult {
  const recorder = useAudioRecorder();
  const isUploadingRef = useRef(false);
  const hasStartedRef = useRef(false);

  const startRecording = useCallback(
    async (stream: MediaStream): Promise<boolean> => {
      if (hasStartedRef.current) return true;
      const started = await recorder.startRecording(stream);
      if (started) {
        hasStartedRef.current = true;
      }
      return started;
    },
    [recorder],
  );

  const stopAndUpload = useCallback(
    async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
      if (isUploadingRef.current) {
        return { success: false, error: "Upload already in progress" };
      }
      isUploadingRef.current = true;

      try {
        const blob = await recorder.stopAndGetBlob();
        if (!blob) {
          return { success: false, error: "No audio data recorded" };
        }

        const filename = `session-${sessionId}-${Date.now()}.webm`;
        await uploadSessionAudio(sessionId, blob, filename);
        recorder.reset();
        hasStartedRef.current = false;
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        return { success: false, error: message };
      } finally {
        isUploadingRef.current = false;
      }
    },
    [recorder],
  );

  const cancel = useCallback(async () => {
    await recorder.stopAndGetBlob();
    recorder.reset();
    hasStartedRef.current = false;
  }, [recorder]);

  return {
    isRecording: recorder.state.isRecording,
    startRecording,
    stopAndUpload,
    cancel,
  };
}
