import { useCallback, useRef, useState } from "react";
import { transcribeAudio, synthesizeSpeech } from "@/api/speech";

type RecordingState = "idle" | "recording" | "processing";

interface UseSpeechInputReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  recordingState: RecordingState;
  error: string | null;
}

/**
 * Hook for speech input via microphone recording + STT transcription.
 * Records audio using MediaRecorder, sends to backend /speech/transcribe,
 * and calls onTranscribed with the resulting text.
 */
export function useSpeechInput(
  onTranscribed: (text: string) => void,
  language: string = "zh-CN",
): UseSpeechInputReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        setRecordingState("processing");
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Stop all tracks
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        transcribeAudio(audioBlob, language)
          .then((result) => {
            if (result.text.trim()) {
              onTranscribed(result.text);
            }
          })
          .catch((err: unknown) => {
            const msg =
              err instanceof Error ? err.message : "Transcription failed";
            setError(msg);
          })
          .finally(() => {
            setRecordingState("idle");
          });
      };

      mediaRecorder.start(250); // collect data every 250ms
      setRecordingState("recording");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Microphone access denied";
      setError(msg);
      setRecordingState("idle");
    }
  }, [language, onTranscribed]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { startRecording, stopRecording, recordingState, error };
}

interface UseTextToSpeechReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
}

/**
 * Hook for TTS playback of AI responses.
 * Sends text to backend /speech/synthesize and plays the returned audio.
 */
export function useTextToSpeech(
  language: string = "zh-CN",
  voice?: string,
): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }

      try {
        setIsSpeaking(true);
        const audioBlob = await synthesizeSpeech(text, language, voice);
        const url = URL.createObjectURL(audioBlob);
        urlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          urlRef.current = null;
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          urlRef.current = null;
        };

        await audio.play();
      } catch {
        setIsSpeaking(false);
      }
    },
    [language, voice],
  );

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
