import { useCallback, useRef, useState } from "react";
import type {
  VoiceLiveToken,
  VoiceLiveOptions,
  VoiceConnectionState,
  AudioState,
  TranscriptSegment,
} from "@/types/voice-live";

/**
 * RTClient lifecycle management hook.
 * Wraps the rt-client SDK, managing WebSocket connection to Azure Voice Live API.
 * Uses dynamic import for rt-client to gracefully handle missing SDK.
 */
export function useVoiceLive(options: VoiceLiveOptions) {
  const clientRef = useRef<unknown>(null);
  const [connectionState, setConnectionState] =
    useState<VoiceConnectionState>("disconnected");
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const transcriptIdCounter = useRef(0);
  const connectionStateRef = useRef<VoiceConnectionState>("disconnected");
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const processResponse = useCallback(async (response: unknown) => {
    const resp = response as {
      textChunks?: () => AsyncIterable<string>;
      audioChunks?: () => AsyncIterable<Uint8Array>;
      transcriptChunks?: () => AsyncIterable<string>;
    };

    setAudioState("speaking");
    optionsRef.current.onAudioStateChange?.("speaking");

    let fullTranscript = "";

    // Process transcript chunks for display
    if (resp.transcriptChunks) {
      for await (const chunk of resp.transcriptChunks()) {
        fullTranscript += chunk;
        const segment: TranscriptSegment = {
          id: `assistant-${++transcriptIdCounter.current}`,
          role: "assistant",
          content: fullTranscript,
          isFinal: false,
          timestamp: Date.now(),
        };
        optionsRef.current.onTranscript?.(segment);
      }
    }

    // Mark final transcript
    if (fullTranscript) {
      optionsRef.current.onTranscript?.({
        id: `assistant-${transcriptIdCounter.current}`,
        role: "assistant",
        content: fullTranscript,
        isFinal: true,
        timestamp: Date.now(),
      });
    }

    setAudioState("idle");
    optionsRef.current.onAudioStateChange?.("idle");
  }, []);

  const startResponseListener = useCallback(
    async (client: unknown) => {
      try {
        const rtClient = client as {
          responses: () => AsyncIterable<unknown>;
        };
        for await (const response of rtClient.responses()) {
          await processResponse(response);
        }
      } catch (error) {
        if (connectionStateRef.current !== "disconnected") {
          optionsRef.current.onError?.(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    },
    [processResponse],
  );

  const connect = useCallback(
    async (tokenData: VoiceLiveToken) => {
      setConnectionState("connecting");
      connectionStateRef.current = "connecting";
      optionsRef.current.onConnectionStateChange?.("connecting");

      try {
        // Dynamic import rt-client to handle case where SDK not yet installed
        const { RTClient } = await import("rt-client");

        const client = new RTClient(
          new URL(tokenData.endpoint),
          { key: tokenData.token },
          { model: tokenData.model },
        );

        // Configure session per D-01 (unified pipeline)
        const sessionConfig: Record<string, unknown> = {
          modalities: ["text", "audio"],
          voice: { type: "azure-standard", name: tokenData.voice_name },
          input_audio_transcription: {
            model: "azure-fast-transcription",
            language: optionsRef.current.language,
          },
          turn_detection: { type: "server_vad" },
          instructions: optionsRef.current.systemPrompt,
          input_audio_noise_reduction: {
            type: "azure_deep_noise_suppression",
          },
        };

        // Add avatar config if avatar is enabled (D-07)
        if (tokenData.avatar_enabled) {
          sessionConfig["avatar"] = {
            character: tokenData.avatar_character,
            video: {
              codec: "h264",
              crop: { top_left: [560, 0], bottom_right: [1360, 1080] },
            },
          };
        }

        const session = await (
          client as { configure: (cfg: Record<string, unknown>) => Promise<unknown> }
        ).configure(sessionConfig);

        clientRef.current = client;
        setConnectionState("connected");
        connectionStateRef.current = "connected";
        setAudioState("idle");
        optionsRef.current.onConnectionStateChange?.("connected");

        // Start response listener in background
        void startResponseListener(client);

        return session;
      } catch (error) {
        setConnectionState("error");
        connectionStateRef.current = "error";
        optionsRef.current.onConnectionStateChange?.("error");
        optionsRef.current.onError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
        throw error;
      }
    },
    [startResponseListener],
  );

  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      try {
        const client = clientRef.current as {
          close?: () => Promise<void>;
        };
        await client.close?.();
      } catch {
        // Ignore close errors
      }
      clientRef.current = null;
    }
    setConnectionState("disconnected");
    connectionStateRef.current = "disconnected";
    setAudioState("idle");
    setIsMuted(false);
    optionsRef.current.onConnectionStateChange?.("disconnected");
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev: boolean) => {
      const next = !prev;
      setAudioState(next ? "muted" : "idle");
      optionsRef.current.onAudioStateChange?.(next ? "muted" : "idle");
      return next;
    });
  }, []);

  const sendTextMessage = useCallback(async (text: string) => {
    if (!clientRef.current) return;
    const client = clientRef.current as {
      sendItem?: (item: unknown) => void;
      generateResponse?: () => void;
    };
    client.sendItem?.({
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }],
    });
    client.generateResponse?.();
  }, []);

  return {
    connect,
    disconnect,
    toggleMute,
    sendTextMessage,
    isMuted,
    connectionState,
    audioState,
    clientRef,
  };
}
