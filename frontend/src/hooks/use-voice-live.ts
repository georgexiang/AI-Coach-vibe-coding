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
          events: () => AsyncIterable<{ type: string } & Record<string, unknown>>;
        };
        for await (const serverEvent of rtClient.events()) {
          if (serverEvent.type === "response") {
            await processResponse(serverEvent);
          } else if (serverEvent.type === "input_audio") {
            // User speech detected
            setAudioState("listening");
            optionsRef.current.onAudioStateChange?.("listening");
          }
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

        // Pass https:// endpoint URL directly — SDK internally sets pathname
        // to voice-agent/realtime and WebSocket auto-converts https→wss (WHATWG spec).
        // Reference: Voice-Live-Agent-With-Avadar/src/app/chat-interface.tsx line 521
        const endpointUrl = tokenData.endpoint;

        if (tokenData.agent_id) {
          console.info("[VoiceLive] Connecting in agent mode", {
            agent_id: tokenData.agent_id,
            project_name: tokenData.project_name,
          });
        } else {
          console.info("[VoiceLive] Connecting in model mode", {
            model: tokenData.model,
          });
        }

        // Auth: Agent mode requires bearer token (API key auth is rejected).
        // Backend returns auth_type="bearer" with an STS token for agent mode.
        // Reference: chat-interface.tsx line 501-509
        //
        // rt-client SDK accepts KeyCredential ({key}) or TokenCredential ({getToken}).
        // TypeScript types may be narrow, so we cast to the union the SDK actually handles.
        const clientAuth: { key: string } | { getToken: (scope: string) => Promise<{ token: string; expiresOnTimestamp: number }> } =
          tokenData.auth_type === "bearer"
            ? {
                getToken: async (_scope: string) => ({
                  token: tokenData.token,
                  expiresOnTimestamp: Date.now() + 600_000, // 10 min STS token
                }),
              }
            : { key: tokenData.token };

        // Both modes use RTVoiceAgentOptions with modelOrAgent
        // Agent mode: { agentId, projectName, agentAccessToken } — reference line 524-529
        // Model mode: model string — reference line 533
        const client = new RTClient(
          new URL(endpointUrl),
          clientAuth as { key: string },
          tokenData.agent_id
            ? {
                modelOrAgent: {
                  agentId: tokenData.agent_id,
                  projectName: tokenData.project_name || "",
                  agentAccessToken:
                    tokenData.auth_type === "bearer"
                      ? tokenData.token
                      : undefined,
                },
                apiVersion: "2025-05-01-preview",
              }
            : {
                modelOrAgent: tokenData.model,
                apiVersion: "2025-05-01-preview",
              },
        );

        // Build session config following reference repo pattern
        // Reference: chat-interface.tsx lines 577-601
        const instructions =
          tokenData.agent_instructions_override ||
          optionsRef.current.systemPrompt;

        // Voice config: reference lines 552-569
        const voice = {
          type: tokenData.voice_type || "azure-standard",
          name: tokenData.voice_name,
          temperature: tokenData.voice_temperature ?? 0.9,
        };

        // Turn detection config
        const turnDetection: Record<string, unknown> = {
          type: tokenData.turn_detection_type || "server_vad",
        };
        // Add EOU detection if enabled (reference lines 540-548)
        if (tokenData.eou_detection) {
          turnDetection["end_of_utterance_detection"] = {
            model: "semantic_detection_v1",
          };
        }

        // Avatar config: reference lines 682-714
        const avatarConfig = tokenData.avatar_enabled
          ? {
              character: tokenData.avatar_character,
              style: tokenData.avatar_style || "casual",
              customized: tokenData.avatar_customized || false,
              video: {
                codec: "h264",
                crop: { top_left: [560, 0], bottom_right: [1360, 1080] },
              },
            }
          : undefined;

        // Session configure — matches reference structure exactly
        const sessionConfig: Record<string, unknown> = {
          instructions: instructions?.length > 0 ? instructions : undefined,
          input_audio_transcription: {
            model: "azure-fast-transcription",
            language:
              tokenData.recognition_language === "auto"
                ? undefined
                : tokenData.recognition_language || undefined,
          },
          turn_detection: turnDetection,
          voice,
          avatar: avatarConfig,
          modalities: ["text", "audio"],
          // Noise suppression: pass null when disabled (reference line 592-596)
          input_audio_noise_reduction: tokenData.noise_suppression
            ? { type: "azure_deep_noise_suppression" }
            : null,
          // Echo cancellation: pass null when disabled (reference line 597-601)
          input_audio_echo_cancellation: tokenData.echo_cancellation
            ? { type: "server_echo_cancellation" }
            : null,
        };

        const session = await (
          client as {
            configure: (
              cfg: Record<string, unknown>,
            ) => Promise<Record<string, unknown>>;
          }
        ).configure(sessionConfig);

        clientRef.current = client;
        setConnectionState("connected");
        connectionStateRef.current = "connected";
        setAudioState("idle");
        optionsRef.current.onConnectionStateChange?.("connected");

        // Start response listener in background
        void startResponseListener(client);

        // Return session so caller can access avatar.ice_servers
        return session as {
          avatar?: { ice_servers?: RTCIceServer[] };
          [key: string]: unknown;
        };
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
