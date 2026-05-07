import { useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { useSession } from "@/hooks/use-session";
import { useScenario } from "@/hooks/use-scenarios";
import { useUnifiedSession } from "@/hooks/use-unified-session";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { uploadSessionAudio } from "@/api/unified-session";
import { UnifiedSessionLayout } from "@/components/session/unified-session-layout";
import { ModeSwitchBar } from "@/components/session/mode-switch-bar";
import { GuidanceCards } from "@/components/session/guidance-cards";
import { VoicePanel } from "@/components/session/left-panel/voice-panel";
import { TextPanel } from "@/components/session/left-panel/text-panel";
import { ChatTranscript } from "@/components/session/right-panel/chat-transcript";
import type { KeyMessageStatus, SessionMessage } from "@/types/session";

/**
 * Unified training session page (D-01, D-05).
 * Full-screen (no UserLayout), reads session ID from URL search params.
 * Voice is default mode (D-05). Supports text/voice/digital_human switching.
 */
export default function UnifiedSession() {
  const { t } = useTranslation("session");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("id") ?? "";

  // Data fetching
  const {
    data: session,
    isLoading: sessionLoading,
    isError: sessionError,
  } = useSession(sessionId || undefined);
  const {
    data: scenario,
    isLoading: scenarioLoading,
    isError: scenarioError,
  } = useScenario(session?.scenario_id);

  // Mode state machine (default: voice per D-05)
  const {
    mode,
    voiceConnectionState,
    modeTransitions,
    switchMode,
    isSwitching,
  } = useUnifiedSession({ defaultMode: "voice" });

  // Audio recorder for voice capture (D-06)
  const { stopAndGetBlob } = useAudioRecorder();

  // Key messages from session state (backend returns JSON string)
  const keyMessagesStatus: KeyMessageStatus[] = useMemo(() => {
    const raw = session?.key_messages_status;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw as string);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [session?.key_messages_status]);

  // Chat messages (placeholder — will be connected to SSE/voice transcript)
  const messages: SessionMessage[] = useMemo(() => [], []);

  // End session handler
  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    // Stop audio recording and upload if there's data
    const blob = await stopAndGetBlob();
    if (blob) {
      await uploadSessionAudio(sessionId, blob);
    }
    navigate(`/user/session-history`);
  }, [sessionId, stopAndGetBlob, navigate]);

  // Error state
  if (sessionError || scenarioError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {t("session.error.loadFailed")}
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/user/scenarios")}
          >
            {tc("back")}
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (sessionLoading || !session || (session.scenario_id && scenarioLoading)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {t("session.loading")}
          </p>
        </div>
      </div>
    );
  }

  const hcpName = scenario?.hcp_profile?.name ?? "HCP";
  const hcpSpecialty = scenario?.hcp_profile?.specialty ?? "";
  const scenarioDescription = scenario?.description ?? "";

  // Header with mode switch bar
  const header = (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <span className="text-sm font-medium truncate max-w-[200px]">
        {scenario?.name ?? t("session.title")}
      </span>
      <ModeSwitchBar
        currentMode={mode}
        onSwitchMode={switchMode}
        isSwitching={isSwitching}
      />
      <Button
        variant="destructive"
        size="sm"
        onClick={handleEndSession}
        data-testid="end-session-btn"
      >
        {t("session.endSession")}
      </Button>
    </header>
  );

  // Left panel based on mode
  const leftPanel =
    mode === "text" ? (
      <TextPanel
        hcpName={hcpName}
        hcpSpecialty={hcpSpecialty}
        scenarioDescription={scenarioDescription}
        keyMessagesStatus={keyMessagesStatus}
      />
    ) : (
      <VoicePanel
        mode={mode}
        voiceConnectionState={
          voiceConnectionState === "idle" ? "disconnected" : voiceConnectionState === "disconnecting" ? "disconnected" : voiceConnectionState
        }
        audioState="idle"
      />
    );

  // Right panel: unified chat transcript
  const rightPanel = (
    <ChatTranscript
      messages={messages}
      isStreaming={false}
      inputMode={mode}
    />
  );

  // Guidance cards
  const guidanceCards = (
    <GuidanceCards
      mode={mode}
      isConnected={voiceConnectionState === "connected"}
      modeTransitions={modeTransitions}
      sessionId={sessionId}
    />
  );

  return (
    <UnifiedSessionLayout
      header={header}
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      guidanceCards={guidanceCards}
    />
  );
}
