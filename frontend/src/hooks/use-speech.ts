import { useCallback, useRef, useState } from "react";
import { transcribeAudio, synthesizeSpeech } from "@/api/speech";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type RecordingState = "idle" | "recording" | "processing";

const STT_SAMPLE_RATE = 16000;

interface UseSpeechInputReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  recordingState: RecordingState;
  error: string | null;
}

interface StreamingSpeechMessage {
  type: "ready" | "recognizing" | "recognized" | "done" | "error";
  text?: string;
  transcript?: string;
  message?: string;
}

interface StreamingSpeechOptions {
  autoStopOnSilence?: boolean;
  silenceMs?: number;
  voiceThreshold?: number;
  minSpeechMs?: number;
  noSpeechTimeoutMs?: number;
  onStreamReady?: (stream: MediaStream) => void | Promise<void>;
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
        const recordedBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        // Stop all tracks
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        convertRecordedAudioToWav(recordedBlob)
          .then((audioBlob) => transcribeAudio(audioBlob, language))
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

export function useStreamingSpeechInput(
  onTranscribed: (text: string) => void,
  language: string = "zh-CN",
  options: StreamingSpeechOptions = {},
): UseSpeechInputReturn {
  const fallback = useSpeechInput(onTranscribed, language);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const usingFallbackRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const stopRequestedRef = useRef(false);
  const hasSpeechRef = useRef(false);
  const speechStartedAtRef = useRef<number | null>(null);
  const silenceStartedAtRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  const autoStopOnSilence = options.autoStopOnSilence ?? false;
  const silenceMs = options.silenceMs ?? 900;
  const voiceThreshold = options.voiceThreshold ?? 0.02;
  const minSpeechMs = options.minSpeechMs ?? 450;
  const noSpeechTimeoutMs = options.noSpeechTimeoutMs ?? 15000;
  const onStreamReady = options.onStreamReady;

  const cleanupAudio = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }
  }, []);

  const requestStreamStop = useCallback((ws: WebSocket) => {
    if (stopRequestedRef.current) return;
    stopRequestedRef.current = true;
    cleanupAudio();
    if (ws.readyState === WebSocket.OPEN) {
      setRecordingState("processing");
      ws.send(JSON.stringify({ type: "stop" }));
      return;
    }
    setRecordingState("idle");
  }, [cleanupAudio]);

  const startAudioPipeline = useCallback(async (ws: WebSocket) => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) throw new Error("当前浏览器不支持语音录制。");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    await onStreamReady?.(stream);
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const gain = audioContext.createGain();
    gain.gain.value = 0;

    recordingStartedAtRef.current = Date.now();

    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      if (autoStopOnSilence) {
        const now = Date.now();
        const level = getAudioLevel(input);
        if (level >= voiceThreshold) {
          hasSpeechRef.current = true;
          speechStartedAtRef.current ??= now;
          silenceStartedAtRef.current = null;
        } else if (hasSpeechRef.current) {
          silenceStartedAtRef.current ??= now;
          const speechDuration = now - (speechStartedAtRef.current ?? now);
          if (speechDuration >= minSpeechMs && now - silenceStartedAtRef.current >= silenceMs) {
            requestStreamStop(ws);
            return;
          }
        } else if (
          recordingStartedAtRef.current &&
          now - recordingStartedAtRef.current >= noSpeechTimeoutMs
        ) {
          requestStreamStop(ws);
          return;
        }
      }
      ws.send(encodePcm16(downsample(input, audioContext.sampleRate, STT_SAMPLE_RATE)));
    };

    source.connect(processor);
    processor.connect(gain);
    gain.connect(audioContext.destination);

    streamRef.current = stream;
    audioContextRef.current = audioContext;
    sourceRef.current = source;
    processorRef.current = processor;
    gainRef.current = gain;
    setRecordingState("recording");
  }, [autoStopOnSilence, minSpeechMs, noSpeechTimeoutMs, onStreamReady, requestStreamStop, silenceMs, voiceThreshold]);

  const startFallbackRecording = useCallback(async () => {
    usingFallbackRef.current = true;
    await fallback.startRecording();
  }, [fallback]);

  const startRecording = useCallback(async () => {
    setError(null);
    finalTranscriptRef.current = "";
    usingFallbackRef.current = false;
    stopRequestedRef.current = false;
    hasSpeechRef.current = false;
    speechStartedAtRef.current = null;
    silenceStartedAtRef.current = null;
    recordingStartedAtRef.current = null;

    if (typeof WebSocket === "undefined") {
      await startFallbackRecording();
      return;
    }

    setRecordingState("processing");
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const token = localStorage.getItem("access_token") ?? "";
    const wsUrl = `${protocol}//${location.host}/api/v1/speech/stream?token=${encodeURIComponent(token)}&language=${encodeURIComponent(language)}`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      let settled = false;

      const fail = (message: string) => {
        if (!settled) {
          settled = true;
          reject(new Error(message));
        }
      };

      ws.onerror = () => fail("语音服务连接失败，已切换为普通转写模式。");
      ws.onclose = () => {
        if (!settled && recordingState !== "idle") {
          fail("语音服务连接已断开，已切换为普通转写模式。");
        }
      };
      ws.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as StreamingSpeechMessage;
        if (message.type === "ready") {
          void startAudioPipeline(ws)
            .then(() => {
              settled = true;
              resolve();
            })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : "Microphone access denied";
              fail(msg);
            });
          return;
        }
        if (message.type === "recognized") {
          finalTranscriptRef.current = message.transcript ?? message.text ?? "";
          return;
        }
        if (message.type === "done") {
          const text = message.text ?? finalTranscriptRef.current;
          if (text.trim()) onTranscribed(text);
          cleanupAudio();
          setRecordingState("idle");
          return;
        }
        if (message.type === "error") {
          const msg = message.message ?? "语音转写失败，请重试或使用文字输入。";
          setError(msg);
          cleanupAudio();
          setRecordingState("idle");
          if (!settled) fail(msg);
        }
      };
    }).catch(async (err: unknown) => {
      cleanupAudio();
      wsRef.current?.close();
      wsRef.current = null;
      const msg = err instanceof Error ? err.message : "语音服务连接失败，已切换为普通转写模式。";
      setError(msg);
      setRecordingState("idle");
      await startFallbackRecording();
    });
  }, [cleanupAudio, language, onTranscribed, recordingState, startAudioPipeline, startFallbackRecording]);

  const stopRecording = useCallback(() => {
    if (usingFallbackRef.current) {
      fallback.stopRecording();
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      requestStreamStop(wsRef.current);
      return;
    }
    cleanupAudio();
    setRecordingState("idle");
  }, [cleanupAudio, fallback, requestStreamStop]);

  if (usingFallbackRef.current) {
    return {
      startRecording,
      stopRecording,
      recordingState: fallback.recordingState,
      error: fallback.error ?? error,
    };
  }

  return { startRecording, stopRecording, recordingState, error };
}

async function convertRecordedAudioToWav(blob: Blob): Promise<Blob> {
  if (blob.type.includes("wav")) return blob;

  const arrayBuffer = await blobToArrayBuffer(blob);
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextCtor();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const rendered = await resampleToMono(decoded, STT_SAMPLE_RATE);
    return encodeWav(rendered.getChannelData(0), rendered.sampleRate);
  } finally {
    await audioContext.close();
  }
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read audio blob"));
    reader.readAsArrayBuffer(blob);
  });
}

async function resampleToMono(
  buffer: AudioBuffer,
  sampleRate: number,
): Promise<AudioBuffer> {
  const frameCount = Math.max(1, Math.ceil(buffer.duration * sampleRate));
  const offlineContext = new OfflineAudioContext(1, frameCount, sampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineContext.destination);
  source.start(0);
  return offlineContext.startRendering();
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([view], { type: "audio/wav" });
}

function downsample(
  samples: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  if (inputSampleRate === outputSampleRate) return samples;
  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(outputLength);
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(samples.length, Math.floor((outputIndex + 1) * ratio));
    let sum = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      sum += samples[inputIndex] ?? 0;
    }
    output[outputIndex] = sum / Math.max(1, end - start);
  }
  return output;
}

function encodePcm16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

function getAudioLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sum += Math.abs(samples[index] ?? 0);
  }
  return sum / samples.length;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

interface UseTextToSpeechReturn {
  speak: (text: string, voiceOverride?: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
}

interface UseTextToSpeechOptions {
  queue?: boolean;
}

interface TextToSpeechQueueItem {
  text: string;
  voice?: string;
}

/**
 * Hook for TTS playback of AI responses.
 * Sends text to backend /speech/synthesize and plays the returned audio.
 */
export function useTextToSpeech(
  language: string = "zh-CN",
  voice?: string,
  options: UseTextToSpeechOptions = {},
): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const queueRef = useRef<TextToSpeechQueueItem[]>([]);
  const queuePlayingRef = useRef(false);
  const playbackGenerationRef = useRef(0);
  const shouldQueue = options.queue ?? false;

  const cleanupCurrentAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const playNextQueued = useCallback(async () => {
    if (queuePlayingRef.current) return;

    const nextItem = queueRef.current.shift();
    if (!nextItem) {
      setIsSpeaking(false);
      return;
    }

    queuePlayingRef.current = true;
    const generation = playbackGenerationRef.current;

    try {
      setIsSpeaking(true);
      const audioBlob = await synthesizeSpeech(
        nextItem.text,
        language,
        nextItem.voice ?? voice,
      );
      if (generation !== playbackGenerationRef.current) return;

      const url = URL.createObjectURL(audioBlob);
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      const finish = () => {
        if (urlRef.current === url) {
          URL.revokeObjectURL(url);
          urlRef.current = null;
        }
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        queuePlayingRef.current = false;
        void playNextQueued();
      };

      audio.onended = finish;
      audio.onerror = finish;

      await audio.play();
    } catch {
      queuePlayingRef.current = false;
      void playNextQueued();
    }
  }, [language, voice]);

  const speak = useCallback(
    async (text: string, voiceOverride?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (shouldQueue) {
        queueRef.current.push({ text: trimmed, voice: voiceOverride });
        void playNextQueued();
        return;
      }

      // Stop any current playback
      cleanupCurrentAudio();
      playbackGenerationRef.current += 1;
      const generation = playbackGenerationRef.current;

      try {
        setIsSpeaking(true);
        const audioBlob = await synthesizeSpeech(trimmed, language, voiceOverride ?? voice);
        if (generation !== playbackGenerationRef.current) return;

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
    [cleanupCurrentAudio, language, playNextQueued, shouldQueue, voice],
  );

  const stop = useCallback(() => {
    playbackGenerationRef.current += 1;
    queueRef.current = [];
    queuePlayingRef.current = false;
    cleanupCurrentAudio();
    setIsSpeaking(false);
  }, [cleanupCurrentAudio]);

  return { speak, stop, isSpeaking };
}
