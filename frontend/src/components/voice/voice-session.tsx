import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from "@/components/ui";
import { ScenarioPanel } from "@/components/coach/scenario-panel";
import { HintsPanel } from "@/components/coach/hints-panel";
import { useVoiceLive } from "@/hooks/use-voice-live";
import { useAvatarStream } from "@/hooks/use-avatar-stream";
import { useAudioHandler } from "@/hooks/use-audio-handler";
import { useVoiceToken } from "@/hooks/use-voice-token";
import { useEndSession } from "@/hooks/use-session";
import { useScenario } from "@/hooks/use-scenarios";
import { persistTranscriptMessage } from "@/api/voice-live";
import { VoiceSessionHeader } from "./voice-session-header";
import { AvatarView } from "./avatar-view";
import { VoiceTranscript } from "./voice-transcript";
import { VoiceControls } from "./voice-controls";
import { FloatingTranscript } from "./floating-transcript";
import type { SessionMode, TranscriptSegment } from "@/types/voice-live";
import type { KeyMessageStatus, CoachingHint } from "@/types/session";
import type { Scenario } from "@/types/scenario";

interface VoiceSessionProps {
  sessionId: string;
  scenarioId: string;
  mode: SessionMode;
  hcpName: string;
  systemPrompt: string;
  language: string;
}

/**
 * Main voice session container orchestrating all hooks and leaf components.
 * Implements three-mode rendering (text/voice/avatar) with graceful fallback chain (D-10).
 * Handles transcript persistence and flush-before-end-session (D-09, Pitfall 5).
 */
export function VoiceSession({
  sessionId,
  scenarioId,
  mode: initialMode,
  hcpName,
  systemPrompt,
  language,
}: VoiceSessionProps) {
  const { t } = useTranslation("voice");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();

  // State
  const [currentMode, setCurrentMode] = useState<SessionMode>(initialMode);
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hints] = useState<CoachingHint[]>([]);
  const [keyMessagesStatus, setKeyMessagesStatus] = useState<KeyMessageStatus[]>([]);
  const [startedAt] = useState<string>(new Date().toISOString());
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // CRITICAL (D-09): Track pending transcript flush promises
  const pendingFlushesRef = useRef<Promise<void>[]>([]);

  // Hooks
  const tokenMutation = useVoiceToken();
  const endSessionMutation = useEndSession();
  const { data: scenario } = useScenario(scenarioId || undefined);

  const handleTranscript = useCallback(
    (segment: TranscriptSegment) => {
      setTranscripts((prev) => {
        // Update existing segment or add new
        const existing = prev.findIndex((s) => s.id === segment.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = segment;
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
      if (state === "error" && currentMode !== "text") {
        toast.error(t("error.connectionFailed"));
        setCurrentMode("text");
      }
    },
    onError: (error) => {
      console.error("Voice Live error:", error);
    },
  });

  const avatarStream = useAvatarStream(videoContainerRef);
  const audioHandler = useAudioHandler();

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

  // Connect voice on mount
  useEffect(() => {
    if (currentMode === "text") return;

    const initVoice = async () => {
      setIsConnecting(true);
      try {
        const tokenData = await tokenMutation.mutateAsync();

        // Initialize audio first
        await audioHandler.initialize();

        // Connect voice
        await voiceLive.connect(tokenData);

        // If digital human mode, try connecting avatar
        const isDigitalHumanMode = currentMode.startsWith("digital_human");
        if (isDigitalHumanMode && tokenData.avatar_enabled) {
          try {
            await avatarStream.connect([], voiceLive.clientRef.current);
          } catch {
            // Avatar failed, fallback to voice-only (D-10)
            toast.error(t("error.avatarFailed"));
            setCurrentMode("voice_pipeline");
          }
        }

        // Start recording for voice input
        audioHandler.startRecording((audioData: Float32Array) => {
          const client = voiceLive.clientRef.current as {
            sendAudio?: (data: Float32Array) => void;
          } | null;
          client?.sendAudio?.(audioData);
        });
      } catch {
        // Voice connection failed, fallback to text (D-10)
        toast.error(t("error.connectionFailed"));
        setCurrentMode("text");
      } finally {
        setIsConnecting(false);
      }
    };

    void initVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // End session handler with transcript flush (D-09, Pitfall 5)
  const handleEndSession = useCallback(() => {
    setShowEndDialog(true);
  }, []);

  const confirmEndSession = useCallback(async () => {
    setShowEndDialog(false);

    // CRITICAL: Flush all pending transcript writes first (D-09)
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
  }, [sessionId, voiceLive, avatarStream, audioHandler, endSessionMutation, navigate]);

  // Text message handler (keyboard input within voice session)
  const handleSendText = useCallback(
    async (text: string) => {
      // Add user message to transcript
      const userSegment: TranscriptSegment = {
        id: `user-text-${Date.now()}`,
        role: "user",
        content: text,
        isFinal: true,
        timestamp: Date.now(),
      };
      handleTranscript(userSegment);

      // Send via voice live if connected, otherwise just persist
      if (voiceLive.connectionState === "connected") {
        await voiceLive.sendTextMessage(text);
      }
    },
    [voiceLive, handleTranscript],
  );

  // Keyboard input ref for text entry
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

  // Session stats for hints panel
  const sessionStats = {
    duration: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
    wordCount: transcripts
      .filter((s) => s.role === "user" && s.isFinal)
      .reduce((acc, s) => acc + s.content.split(/\s+/).length, 0),
    messageCount: transcripts.filter((s) => s.isFinal).length,
  };

  // Last transcript for floating overlay
  const lastTranscript =
    transcripts.length > 0
      ? transcripts[transcripts.length - 1] ?? null
      : null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <VoiceSessionHeader
        scenarioTitle={currentScenario.name}
        mode={currentMode}
        connectionState={voiceLive.connectionState}
        onEndSession={handleEndSession}
        startedAt={startedAt}
        isFullScreen={isFullScreen}
        onToggleView={() => setIsFullScreen((prev) => !prev)}
      />

      {/* Main content: 3-panel layout — stacks vertically on mobile */}
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
              videoContainerRef={videoContainerRef}
              isAvatarConnected={avatarStream.isConnected}
              audioState={voiceLive.audioState}
              analyserData={audioHandler.analyserData}
              isConnecting={isConnecting}
              hcpName={hcpName}
              isFullScreen={isFullScreen}
              className="h-full"
            />

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

          {/* Transcript area (non-full-screen) */}
          {!isFullScreen && (
            <VoiceTranscript
              transcripts={transcripts}
              hcpName={hcpName}
              className="h-[200px] border-t border-border"
            />
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

          {/* Voice controls */}
          <VoiceControls
            audioState={voiceLive.audioState}
            connectionState={voiceLive.connectionState}
            isMuted={voiceLive.isMuted}
            onToggleMute={voiceLive.toggleMute}
            onToggleKeyboard={() => setShowKeyboard((prev) => !prev)}
            onToggleView={() => setIsFullScreen((prev) => !prev)}
            isFullScreen={isFullScreen}
            className="border-t border-border"
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
