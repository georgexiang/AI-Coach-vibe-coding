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
 * Session config built from per-HCP settings in tokenData (D-08).
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

        // Determine WebSocket URL based on agent vs model mode (D-11)
        const endpointUrl = new URL(tokenData.endpoint);
        let wsUrl: string;

        if (tokenData.agent_id) {
          // Agent mode: voice-agent/realtime
          wsUrl = `wss://${endpointUrl.host}/voice-agent/realtime?api-version=2025-04-01-preview`;
          console.info("[VoiceLive] Connecting in agent mode", {
            agent_id: tokenData.agent_id,
            project_name: tokenData.project_name,
          });
        } else {
          // Model mode: openai/realtime with deployment
          wsUrl = `wss://${endpointUrl.host}/openai/realtime?api-version=2025-04-01-preview&deployment=${encodeURIComponent(tokenData.model)}`;
          console.info("[VoiceLive] Connecting in model mode", {
            model: tokenData.model,
          });
        }

        const client = new RTClient(
          new URL(wsUrl),
          { key: tokenData.token },
          { model: tokenData.model },
        );

        // Configure session with per-HCP settings from token broker (D-08)
        const sessionConfig: Record<string, unknown> = {
          modalities: ["text", "audio"],
          voice: {
            type: tokenData.voice_type || "azure-standard",
            name: tokenData.voice_name,
            temperature: tokenData.voice_temperature ?? 0.9,
          },
          input_audio_transcription: {
            model: "azure-fast-transcription",
            language:
              tokenData.recognition_language === "auto"
                ? optionsRef.current.language
                : tokenData.recognition_language ||
                  optionsRef.current.language,
          },
          turn_detection: {
            type: tokenData.turn_detection_type || "server_vad",
          },
          instructions:
            tokenData.agent_instructions_override ||
            optionsRef.current.systemPrompt,
        };

        // Conditionally add noise suppression (per-HCP setting)
        if (tokenData.noise_suppression) {
          sessionConfig["input_audio_noise_reduction"] = {
            type: "azure_deep_noise_suppression",
          };
        }

        // Conditionally add echo cancellation (per-HCP setting)
        if (tokenData.echo_cancellation) {
          sessionConfig["input_audio_echo_cancellation"] = {
            type: "server_echo_cancellation",
          };
        }

        // Add agent config if agent mode (D-11)
        if (tokenData.agent_id) {
          sessionConfig["agent_id"] = tokenData.agent_id;
          if (tokenData.project_name) {
            sessionConfig["project_name"] = tokenData.project_name;
          }
        }

        // Add avatar config if avatar is enabled (D-07, with per-HCP style/customized)
        if (tokenData.avatar_enabled) {
          sessionConfig["avatar"] = {
            character: tokenData.avatar_character,
            style: tokenData.avatar_style || "casual",
            customized: tokenData.avatar_customized || false,
            video: {
              codec: "h264",
              crop: { top_left: [560, 0], bottom_right: [1360, 1080] },
            },
          };
        }

        const session = await (
          client as {
            configure: (
              cfg: Record<string, unknown>,
            ) => Promise<unknown>;
          }
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
