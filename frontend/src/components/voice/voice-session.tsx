import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AudioLines, Settings2, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useVoiceLive } from "@/hooks/use-voice-live";
import { useAvatarStream } from "@/hooks/use-avatar-stream";
import { useAudioHandler } from "@/hooks/use-audio-handler";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useEndSession } from "@/hooks/use-session";
import { useScenario } from "@/hooks/use-scenarios";
import { persistTranscriptMessage } from "@/api/voice-live";
import { VoiceSessionHeader } from "./voice-session-header";
import { AvatarView } from "./avatar-view";
import { VoiceTranscript } from "./voice-transcript";
import { VoiceControls } from "./voice-controls";
import { VoiceConfigPanel } from "./voice-config-panel";
import type {
  SessionMode,
  TranscriptSegment,
  VoiceConfigSettings,
} from "@/types/voice-live";
import type { KeyMessageStatus } from "@/types/session";
import type { Scenario } from "@/types/scenario";

interface VoiceSessionProps {
  sessionId: string;
  scenarioId: string;
  hcpProfileId: string;
  hcpName: string;
  systemPrompt: string;
  language: string;
  /** Azure TTS Avatar character ID (e.g. "lisa", "lori"). */
  avatarCharacter?: string;
  /** Avatar style variant (e.g. "casual", "formal"). */
  avatarStyle?: string;
  /** HCP voice name for display in config panel. */
  voiceName?: string;
}

/**
 * Main voice session container — AI Foundry-style 3-panel layout.
 *
 * Left: Avatar video/preview + voice controls
 * Right: Tabbed panel (Transcript | Configuration)
 *
 * Supports both realtime model and LLM model scenarios via Voice Live API.
 */
export function VoiceSession({
  sessionId,
  scenarioId,
  hcpProfileId,
  hcpName,
  systemPrompt,
  language,
  avatarCharacter,
  avatarStyle,
  voiceName = "",
}: VoiceSessionProps) {
  const { t } = useTranslation("voice");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();

  // State
  const [currentMode, setCurrentMode] = useState<SessionMode>("digital_human_realtime_model");
  const initialModeRef = useRef<SessionMode>("digital_human_realtime_model");
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [keyMessagesStatus, setKeyMessagesStatus] = useState<
    KeyMessageStatus[]
  >([]);
  const [startedAt] = useState<string>(new Date().toISOString());
  const videoRef = useRef<HTMLVideoElement>(null);

  // Voice config state (for Configuration panel)
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfigSettings>({
    language: language || "auto",
    autoDetect: !language || language === "auto",
    interimResponse: true,
    proactiveEngagement: false,
  });

  // Track pending transcript flush promises (D-09)
  const pendingFlushesRef = useRef<Promise<void>[]>([]);

  // Hooks
  const endSessionMutation = useEndSession();
  const { data: scenario } = useScenario(scenarioId || undefined);

  const handleTranscript = useCallback(
    (segment: TranscriptSegment) => {
      setTranscripts((prev) => {
        const existing = prev.findIndex((s) => s.id === segment.id);
        if (existing >= 0) {
          const updated = [...prev];
          const existingSegment = updated[existing]!;
          if (!segment.isFinal && !existingSegment.isFinal) {
            // Streaming delta: accumulate content instead of replacing
            updated[existing] = {
              ...segment,
              content: existingSegment.content + segment.content,
            };
          } else {
            // Final event: replace with complete content
            updated[existing] = segment;
          }
          return updated;
        }
        return [...prev, segment];
      });

      // Persist final transcripts to backend
      if (segment.isFinal) {
        const flushPromise = persistTranscriptMessage(
          sessionId,
          segment.role,
          segment.content,
        );
        pendingFlushesRef.current.push(flushPromise);
        flushPromise.finally(() => {
          pendingFlushesRef.current = pendingFlushesRef.current.filter(
            (p) => p !== flushPromise,
          );
        });
      }
    },
    [sessionId],
  );

  const avatarStream = useAvatarStream(videoRef);
  const audioHandler = useAudioHandler();
  const audioPlayer = useAudioPlayer();

  const voiceLive = useVoiceLive({
    language,
    systemPrompt,
    onTranscript: handleTranscript,
    onAudioDelta: audioPlayer.playAudio,
    onConnectionStateChange: (state) => {
      if (state === "error") {
        toast.error(t("error.connectionFailed"));
      }
    },
    onError: (error) => {
      console.error("Voice Live error:", error);
    },
  });

  // Escape key exits fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  // Initialize key messages from scenario
  useEffect(() => {
    if (scenario && keyMessagesStatus.length === 0) {
      setKeyMessagesStatus(
        scenario.key_messages.map((msg) => ({
          message: msg,
          delivered: false,
          detected_at: null,
        })),
      );
    }
  }, [scenario, keyMessagesStatus.length]);

  // Voice initialization logic — extracted to reusable callback
  const initVoice = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Initialize audio (mic permission + AudioWorklet)
      try {
        await audioHandler.initialize();
      } catch (audioError) {
        if (audioError instanceof DOMException && audioError.name === "NotAllowedError") {
          toast.error(t("error.micDenied"));
        } else {
          toast.error(t("error.audioWorkletFailed"));
        }
        setIsConnecting(false);
        return;
      }

      // Wire up avatar SDP callback BEFORE connecting
      voiceLive.avatarSdpCallbackRef.current = (serverSdp: string) => {
        void avatarStream.handleServerSdp(serverSdp);
      };

      // Connect via backend WebSocket proxy
      const result = await voiceLive.connect(hcpProfileId, systemPrompt);

      // Resolve mode from proxy response
      const resolvedMode: SessionMode = result.avatarEnabled
        ? "digital_human_realtime_model"
        : "voice_realtime_model";
      setCurrentMode(resolvedMode);
      initialModeRef.current = resolvedMode;

      // Connect avatar WebRTC using ICE servers from session
      if (result.avatarEnabled) {
        try {
          await avatarStream.connect(
            result.iceServers,
            async (clientSdp: string) => {
              voiceLive.send({
                type: "session.avatar.connect",
                client_sdp: clientSdp,
              });
            },
          );
          console.info("[VoiceSession] Avatar WebRTC connected");
        } catch (avatarError) {
          console.error("[VoiceSession] Avatar WebRTC failed:", avatarError);
          toast.error(t("error.avatarFailed"));
          setCurrentMode("voice_realtime_model");
        }
      }

      // Start recording — send audio via backend WebSocket proxy
      audioHandler.startRecording((audioData: Float32Array) => {
        if (voiceLive.isMuted) return;
        const int16 = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          const s = Math.max(-1, Math.min(1, audioData[i] ?? 0));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(int16.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        const base64 = btoa(binary);
        voiceLive.sendAudio(base64);
      });
    } catch (error) {
      console.error("[VoiceSession] Connection failed:", error);
      toast.error(t("error.connectionFailed"));
    } finally {
      setIsConnecting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hcpProfileId, systemPrompt]);

  // Start session handler — user clicks Start button
  const handleStartSession = useCallback(() => {
    setSessionStarted(true);
  }, []);

  // Connect voice + digital human when session is started
  useEffect(() => {
    if (!sessionStarted) return;

    void initVoice();

    // Cleanup on unmount
    return () => {
      void voiceLive.disconnect();
      avatarStream.disconnect();
      audioHandler.cleanup();
      audioPlayer.stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted]);

  // End session handler with transcript flush (D-09)
  const handleEndSession = useCallback(() => {
    setShowEndDialog(true);
  }, []);

  const confirmEndSession = useCallback(async () => {
    setShowEndDialog(false);

    // Flush all pending transcript writes first (D-09)
    await Promise.all(pendingFlushesRef.current);

    // Disconnect voice and avatar
    await voiceLive.disconnect();
    avatarStream.disconnect();
    audioHandler.cleanup();
    audioPlayer.stopAudio();

    // Call endSession API
    try {
      await endSessionMutation.mutateAsync(sessionId);
      navigate(`/user/scoring/${sessionId}`);
    } catch {
      toast.error(t("error.connectionFailed"));
      navigate("/user/scenarios");
    }
  }, [
    sessionId,
    voiceLive,
    avatarStream,
    audioHandler,
    endSessionMutation,
    navigate,
  ]);

  // Text message handler (keyboard input within voice session)
  const handleSendText = useCallback(
    async (text: string) => {
      const userSegment: TranscriptSegment = {
        id: `user-text-${Date.now()}`,
        role: "user",
        content: text,
        isFinal: true,
        timestamp: Date.now(),
      };
      handleTranscript(userSegment);

      if (voiceLive.connectionState === "connected") {
        await voiceLive.sendTextMessage(text);
      }
    },
    [voiceLive, handleTranscript],
  );

  const [inputText, setInputText] = useState("");

  const handleKeyboardSubmit = useCallback(() => {
    if (!inputText.trim()) return;
    void handleSendText(inputText.trim());
    setInputText("");
  }, [inputText, handleSendText]);

  // Default scenario for loading state
  const defaultScenario: Scenario = {
    id: "",
    name: tc("loading"),
    description: "",
    product: "",
    therapeutic_area: "",
    mode: "f2f",
    difficulty: "medium",
    status: "active",
    hcp_profile_id: "",
    key_messages: [],
    weight_key_message: 30,
    weight_objection_handling: 25,
    weight_communication: 20,
    weight_product_knowledge: 15,
    weight_scientific_info: 10,
    pass_threshold: 70,
    estimated_duration: 15,
    created_by: "",
    created_at: "",
    updated_at: "",
  };

  const currentScenario = scenario ?? defaultScenario;

  // Whether avatar is currently active (connected or character configured)
  const avatarActive = avatarStream.isConnected || currentMode.includes("digital_human");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100">
      {/* Compact header */}
      <VoiceSessionHeader
        scenarioTitle={currentScenario.name}
        currentMode={currentMode}
        initialMode={initialModeRef.current}
        connectionState={voiceLive.connectionState}
        onEndSession={handleEndSession}
        startedAt={startedAt}
        isFullScreen={isFullScreen}
        onToggleView={() => setIsFullScreen((prev) => !prev)}
      />

      {/* AI Foundry-style layout: Avatar (left) + Transcript/Config (right) */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 gap-4 p-4">
        {/* Left panel: Avatar / Voice orb — fixed width, portrait ratio */}
        <div className="relative flex w-[480px] shrink-0 flex-col overflow-hidden rounded-xl bg-slate-900 shadow-lg">
          <AvatarView
            videoRef={videoRef}
            isAvatarConnected={avatarStream.isConnected}
            audioState={voiceLive.audioState}
            isConnecting={isConnecting}
            hcpName={hcpName}
            isFullScreen={false}
            avatarCharacter={avatarCharacter}
            avatarStyle={avatarStyle}
            className="flex-1"
          />

          {/* Start button overlay — shown before session begins */}
          {!sessionStarted && !isConnecting && (
            <div
              className="absolute inset-0 z-30 flex flex-col items-center justify-center"
              data-testid="start-overlay"
            >
              <button
                type="button"
                onClick={handleStartSession}
                className={cn(
                  "group flex items-center gap-3 rounded-full px-8 py-4",
                  "bg-white/15 text-white shadow-lg backdrop-blur-md",
                  "transition-all duration-200",
                  "hover:scale-105 hover:bg-white/25 hover:shadow-xl",
                  "focus:outline-none focus:ring-2 focus:ring-white/50",
                )}
                aria-label={t("startButton")}
                data-testid="start-session-btn"
              >
                <AudioLines className="h-6 w-6 text-white transition-transform group-hover:scale-110" />
                <span className="text-lg font-semibold">{t("startButton")}</span>
              </button>
            </div>
          )}

          {/* Bottom controls on avatar panel */}
          <VoiceControls
            audioState={voiceLive.audioState}
            connectionState={voiceLive.connectionState}
            isMuted={voiceLive.isMuted}
            onToggleMute={voiceLive.toggleMute}
            onToggleKeyboard={() => setShowKeyboard((prev) => !prev)}
            onToggleView={() => setIsFullScreen((prev) => !prev)}
            onEndSession={handleEndSession}
            isFullScreen={isFullScreen}
          />
        </div>

        {/* Right panel: Tabbed Transcript + Configuration (AI Foundry style) */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-lg">
          {/* Scenario header */}
          <div className="shrink-0 border-b border-slate-200 px-5 py-3">
            <h3 className="text-base font-semibold text-slate-900">
              {currentScenario.name}
            </h3>
            {currentScenario.description && (
              <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">
                {currentScenario.description}
              </p>
            )}
          </div>

          {/* Tabbed area: Transcript | Configuration */}
          <Tabs defaultValue="transcript" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mt-2 w-fit shrink-0" data-testid="right-panel-tabs">
              <TabsTrigger value="transcript" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                {t("tabs.transcript")}
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                {t("tabs.config")}
              </TabsTrigger>
            </TabsList>

            {/* Transcript tab */}
            <TabsContent value="transcript" className="mt-0 min-h-0 flex-1 flex flex-col">
              <div className="min-h-0 flex-1" data-testid="chat-area">
                {transcripts.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-slate-400">
                      {sessionStarted ? t("waitingForResponse") : t("startPrompt")}
                    </p>
                  </div>
                ) : (
                  <VoiceTranscript
                    transcripts={transcripts}
                    hcpName={hcpName}
                    className="h-full"
                  />
                )}
              </div>

              {/* Keyboard input area */}
              {showKeyboard && (
                <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleKeyboardSubmit();
                      }
                    }}
                    placeholder={t("keyboardInput")}
                    className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="sm" onClick={handleKeyboardSubmit}>
                    {tc("send")}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Configuration tab */}
            <TabsContent value="config" className="mt-0 min-h-0 flex-1" data-testid="config-tab">
              <VoiceConfigPanel
                config={voiceConfig}
                onConfigChange={setVoiceConfig}
                voiceName={voiceName}
                avatarEnabled={avatarActive}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* End session confirmation dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("endSessionTitle")}</DialogTitle>
            <DialogDescription>{t("endSessionConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEndDialog(false)}
            >
              {t("continueSession")}
            </Button>
            <Button variant="destructive" onClick={confirmEndSession}>
              {t("endSession")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
