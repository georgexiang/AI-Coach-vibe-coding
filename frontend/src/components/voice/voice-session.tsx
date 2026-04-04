import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AudioLines } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { ScenarioPanel } from "@/components/coach/scenario-panel";
import { HintsPanel } from "@/components/coach/hints-panel";
import { useVoiceLive } from "@/hooks/use-voice-live";
import { useAvatarStream } from "@/hooks/use-avatar-stream";
import { useAudioHandler } from "@/hooks/use-audio-handler";
import { useEndSession } from "@/hooks/use-session";
import { useScenario } from "@/hooks/use-scenarios";
import { persistTranscriptMessage } from "@/api/voice-live";
import { VoiceSessionHeader } from "./voice-session-header";
import { AvatarView } from "./avatar-view";
import { VoiceTranscript } from "./voice-transcript";
import { VoiceConfigPanel } from "./voice-config-panel";
import { VoiceControls } from "./voice-controls";
import { FloatingTranscript } from "./floating-transcript";
import type {
  SessionMode,
  TranscriptSegment,
  VoiceConfigSettings,
} from "@/types/voice-live";
import type { KeyMessageStatus, CoachingHint } from "@/types/session";
import type { Scenario } from "@/types/scenario";

interface VoiceSessionProps {
  sessionId: string;
  scenarioId: string;
  hcpProfileId: string;
  hcpName: string;
  systemPrompt: string;
  language: string;
}

/**
 * Main voice session container — digital human + voice is the primary flow.
 * No fallback to text mode. Avatar must appear.
 * Supports both realtime model and LLM model scenarios via Voice Live API.
 */
export function VoiceSession({
  sessionId,
  scenarioId,
  hcpProfileId,
  hcpName,
  systemPrompt,
  language,
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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [hints] = useState<CoachingHint[]>([]);
  const [keyMessagesStatus, setKeyMessagesStatus] = useState<
    KeyMessageStatus[]
  >([]);
  const [startedAt] = useState<string>(new Date().toISOString());
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfigSettings>({
    language: language || "auto",
    autoDetect: !language || language === "auto",
    interimResponse: true,
    proactiveEngagement: false,
  });
  const [bottomTab, setBottomTab] = useState<string>("transcript");
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const voiceLive = useVoiceLive({
    language,
    systemPrompt,
    onTranscript: handleTranscript,
    onConnectionStateChange: (state) => {
      if (state === "error") {
        toast.error(t("error.connectionFailed"));
      }
    },
    onError: (error) => {
      console.error("Voice Live error:", error);
    },
  });

  const avatarStream = useAvatarStream(videoRef);
  const audioHandler = useAudioHandler();

  // Send config changes to backend via WebSocket session.update
  const handleConfigChange = useCallback(
    (newConfig: VoiceConfigSettings) => {
      setVoiceConfig(newConfig);
      if (voiceLive.connectionState === "connected") {
        voiceLive.send({
          type: "session.update",
          session: {
            input_audio_transcription: { language: newConfig.language === "auto" ? undefined : newConfig.language },
          },
        });
      }
    },
    [voiceLive],
  );

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
      // When server sends session.avatar.connecting event, this callback
      // forwards the SDP answer to the avatar WebRTC hook
      voiceLive.avatarSdpCallbackRef.current = (serverSdp: string) => {
        void avatarStream.handleServerSdp(serverSdp);
      };

      // Connect via backend WebSocket proxy — returns { avatarEnabled, model, iceServers }
      const result = await voiceLive.connect(hcpProfileId, systemPrompt);

      // Resolve mode from proxy response (always model mode via backend proxy)
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
              // Send SDP offer via backend proxy → Azure
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
          // Continue with voice-only mode — avatar is a Voice Live API
          // feature that enhances the session but voice still works without it
          setCurrentMode("voice_realtime_model");
        }
      }

      // Start recording — send audio via backend WebSocket proxy
      audioHandler.startRecording((audioData: Float32Array) => {
        if (voiceLive.isMuted) return; // Skip sending when muted
        // Convert Float32Array → Int16 PCM → base64
        const int16 = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          const s = Math.max(-1, Math.min(1, audioData[i] ?? 0));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(int16.buffer);
        // Encode to base64 for JSON transport through proxy
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

    // Cleanup on unmount — prevent dangling WebSocket connections
    return () => {
      void voiceLive.disconnect();
      avatarStream.disconnect();
      audioHandler.cleanup();
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

    // Call endSession API
    try {
      await endSessionMutation.mutateAsync(sessionId);
      navigate(`/user/scoring/${sessionId}`);
    } catch {
      // Error handled by mutation
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

  const sessionStats = {
    duration: Math.floor(
      (Date.now() - new Date(startedAt).getTime()) / 1000,
    ),
    wordCount: transcripts
      .filter((s) => s.role === "user" && s.isFinal)
      .reduce((acc, s) => acc + s.content.split(/\s+/).length, 0),
    messageCount: transcripts.filter((s) => s.isFinal).length,
  };

  const lastTranscript =
    transcripts.length > 0
      ? (transcripts[transcripts.length - 1] ?? null)
      : null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Header */}
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

      {/* Main content: 3-panel layout */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left panel: Scenario */}
        {!isFullScreen && (
          <ScenarioPanel
            scenario={currentScenario}
            keyMessagesStatus={keyMessagesStatus}
            isCollapsed={leftCollapsed}
            onToggle={() => setLeftCollapsed((prev) => !prev)}
          />
        )}

        {/* Center panel: Voice/Avatar + Transcript + Controls */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Avatar/Waveform area */}
          <div className="relative flex-1">
            <AvatarView
              videoRef={videoRef}
              isAvatarConnected={avatarStream.isConnected}
              audioState={voiceLive.audioState}
              analyserData={audioHandler.analyserData}
              isConnecting={isConnecting}
              hcpName={hcpName}
              isFullScreen={isFullScreen}
              className="h-full"
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
                    "bg-slate-800/90 text-white shadow-lg backdrop-blur-sm",
                    "transition-all duration-200",
                    "hover:scale-105 hover:bg-slate-700/90 hover:shadow-xl",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900",
                  )}
                  aria-label={t("startButton")}
                  data-testid="start-session-btn"
                >
                  <AudioLines className="h-6 w-6 text-white transition-transform group-hover:scale-110" />
                  <span className="text-lg font-semibold">{t("startButton")}</span>
                </button>
              </div>
            )}

            {/* Floating transcript overlay in full-screen mode */}
            {isFullScreen && (
              <div className="absolute bottom-0 left-0 right-0">
                <FloatingTranscript
                  lastTranscript={lastTranscript}
                  hcpName={hcpName}
                />
              </div>
            )}
          </div>

          {/* Transcript / Config tabbed area (non-full-screen) */}
          {!isFullScreen && (
            <div className="h-[200px] border-t border-border" data-testid="bottom-tabbed-area">
              <Tabs value={bottomTab} onValueChange={setBottomTab} className="flex h-full flex-col">
                <TabsList className="mx-4 mt-1 w-fit shrink-0">
                  <TabsTrigger value="transcript" data-testid="tab-transcript">
                    {t("tabs.transcript")}
                  </TabsTrigger>
                  <TabsTrigger value="config" data-testid="tab-config">
                    {t("tabs.config")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="transcript" className="min-h-0 flex-1">
                  <VoiceTranscript
                    transcripts={transcripts}
                    hcpName={hcpName}
                    className="h-full"
                  />
                </TabsContent>
                <TabsContent value="config" className="min-h-0 flex-1">
                  <VoiceConfigPanel
                    config={voiceConfig}
                    onConfigChange={handleConfigChange}
                    voiceName={hcpName}
                    avatarEnabled={currentMode.startsWith("digital_human")}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Keyboard input area */}
          {showKeyboard && (
            <div className="flex items-center gap-2 border-t border-border p-3">
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
                className="flex-1 rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button size="sm" onClick={handleKeyboardSubmit}>
                {tc("send")}
              </Button>
            </div>
          )}

          {/* Voice controls — AI Foundry-style bottom bar */}
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

        {/* Right panel: Hints */}
        {!isFullScreen && (
          <HintsPanel
            hints={hints}
            keyMessagesStatus={keyMessagesStatus}
            sessionStats={sessionStats}
            isCollapsed={rightCollapsed}
            onToggle={() => setRightCollapsed((prev) => !prev)}
          />
        )}
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
