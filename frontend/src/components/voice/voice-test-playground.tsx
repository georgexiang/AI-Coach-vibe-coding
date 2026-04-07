import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AvatarView } from "@/components/voice/avatar-view";
import { VoiceControls } from "@/components/voice/voice-controls";
import { useVoiceLive } from "@/hooks/use-voice-live";
import { useAvatarStream } from "@/hooks/use-avatar-stream";
import { useAudioHandler } from "@/hooks/use-audio-handler";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import type { TranscriptSegment } from "@/types/voice-live";

export type SessionState = "idle" | "connecting" | "connected" | "error" | "stopping";

export interface VoiceTestPlaygroundProps {
  /** HCP profile ID — connect in agent mode */
  hcpProfileId?: string;
  /** VL Instance ID — connect in model mode (used when no hcpProfileId) */
  vlInstanceId?: string;
  /** System prompt / instructions override */
  systemPrompt?: string;
  /** Recognition language (default "auto") */
  language?: string;
  /** Avatar character from VL Instance config */
  avatarCharacter?: string;
  /** Avatar style from VL Instance config */
  avatarStyle?: string;
  /** Whether avatar is enabled in the VL Instance */
  avatarEnabled: boolean;
  /** Display name for avatar badge */
  hcpName?: string;
  /** Disable Start button */
  disabled?: boolean;
  /** Message to show when disabled */
  disabledMessage?: string;
  /** Callback for session state changes (e.g. VL editor disables form during test) */
  onSessionStateChange?: (state: SessionState) => void;
  /** Extra content in the header area (e.g. "Assign to HCP" button) */
  headerExtra?: ReactNode;
  /** Title override */
  title?: string;
  className?: string;
}

/**
 * Shared Voice Test Playground — used by both VL Instance editor and HCP editor.
 *
 * Renders: AvatarView + VoiceControls + transcript + keyboard input.
 * Caller decides agent vs model mode via hcpProfileId/vlInstanceId props.
 */
export function VoiceTestPlayground({
  hcpProfileId,
  vlInstanceId,
  systemPrompt = "",
  language = "auto",
  avatarCharacter,
  avatarStyle,
  avatarEnabled,
  hcpName = "",
  disabled,
  disabledMessage,
  onSessionStateChange,
  headerExtra,
  title,
  className,
}: VoiceTestPlaygroundProps) {
  const { t } = useTranslation(["admin", "voice"]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptPanelRef = useRef<HTMLDivElement>(null);
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardText, setKeyboardText] = useState("");

  const audioHandler = useAudioHandler();
  const audioPlayer = useAudioPlayer();
  const avatarStream = useAvatarStream(videoRef);

  // Notify parent of state changes
  useEffect(() => {
    onSessionStateChange?.(sessionState);
  }, [sessionState, onSessionStateChange]);

  const onTranscript = useCallback((seg: TranscriptSegment) => {
    setTranscripts((prev) => {
      const idx = prev.findIndex((s) => s.id === seg.id);
      if (idx >= 0) {
        const next = [...prev];
        const existing = next[idx]!;
        if (!seg.isFinal && !existing.isFinal) {
          next[idx] = { ...seg, content: existing.content + seg.content };
        } else {
          next[idx] = seg;
        }
        return next;
      }
      const next = [...prev, seg];
      // Cap transcript buffer to avoid unbounded memory growth
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  const onError = useCallback((err: Error) => {
    toast.error(err.message);
    setSessionState("error");
  }, []);

  const voiceLive = useVoiceLive({
    language,
    systemPrompt,
    onTranscript,
    onAudioDelta: audioPlayer.playAudio,
    onError,
  });

  const isActive = sessionState === "connected" || sessionState === "stopping";
  const isConnecting = sessionState === "connecting";

  const startTest = useCallback(async () => {
    try {
      setSessionState("connecting");
      setTranscripts([]);

      // Mic permission check with user-friendly error
      try {
        await audioHandler.initialize();
      } catch (err) {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          toast.error(t("admin:hcp.permissionDeniedMic"));
          setSessionState("error");
          return;
        }
        throw err;
      }

      voiceLive.avatarSdpCallbackRef.current = avatarStream.handleServerSdp;

      const result = await voiceLive.connect(
        hcpProfileId,
        systemPrompt,
        vlInstanceId,
      );

      if (result.avatarEnabled) {
        await avatarStream.connect(result.iceServers, async (clientSdp) => {
          voiceLive.send({
            type: "session.avatar.connect",
            client_sdp: clientSdp,
          });
        });
      }

      // Start recording mic audio
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
        voiceLive.sendAudio(btoa(binary));
      });

      setSessionState("connected");
    } catch (err) {
      toast.error(String(err));
      setSessionState("error");
    }
  }, [hcpProfileId, vlInstanceId, systemPrompt, audioHandler, avatarStream, voiceLive, t]);

  const stopTest = useCallback(async () => {
    setSessionState("stopping");
    try {
      await voiceLive.disconnect();
      avatarStream.disconnect();
      audioHandler.cleanup();
      audioPlayer.stopAudio();
    } finally {
      setSessionState("idle");
    }
  }, [voiceLive, avatarStream, audioHandler, audioPlayer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      voiceLive.disconnect().catch(() => { /* ignore */ });
      avatarStream.disconnect();
      audioHandler.cleanup();
      audioPlayer.stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force disconnect when key props change while connected
  useEffect(() => {
    if (sessionState === "connected" || sessionState === "connecting") {
      void stopTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hcpProfileId, vlInstanceId]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptPanelRef.current) {
      transcriptPanelRef.current.scrollTop =
        transcriptPanelRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div className={cn("flex flex-col bg-muted/10", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <h2 className="text-sm font-semibold">
          {title ?? t("admin:hcp.playgroundTitle")}
        </h2>
        {headerExtra}
      </div>

      {/* Test area */}
      <div className="flex-1 relative flex flex-col">
        {/* Avatar / Audio orb — fills available space */}
        <div className="flex-1 relative min-h-[360px]">
          <AvatarView
            videoRef={videoRef}
            isAvatarConnected={sessionState === "connected"}
            audioState={voiceLive.audioState}
            isConnecting={isConnecting}
            hcpName={hcpName}
            isFullScreen={false}
            avatarCharacter={avatarEnabled ? (avatarCharacter ?? undefined) : undefined}
            avatarStyle={avatarEnabled ? (avatarStyle ?? undefined) : undefined}
            className="absolute inset-0"
          />
        </div>

        {/* Transcript panel */}
        {isActive && transcripts.length > 0 && (
          <div
            ref={transcriptPanelRef}
            className="shrink-0 max-h-32 overflow-y-auto border-t bg-background/90 backdrop-blur-sm px-4 py-2 space-y-1"
          >
            {transcripts.map((seg) => (
              <div
                key={seg.id}
                className={cn(
                  "text-xs leading-relaxed",
                  seg.role === "user"
                    ? "text-primary font-medium"
                    : "text-foreground",
                )}
              >
                <span className="text-muted-foreground mr-1.5">
                  {seg.role === "user"
                    ? t("admin:hcp.transcriptUser", { defaultValue: "You:" })
                    : t("admin:hcp.transcriptAgent", { defaultValue: "AI:" })}
                </span>
                {seg.content}
                {!seg.isFinal && (
                  <span className="text-muted-foreground animate-pulse">
                    ...
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Controls bar */}
        <div className="shrink-0 border-t bg-background/80 backdrop-blur-sm">
          {isActive ? (
            <>
              <VoiceControls
                audioState={voiceLive.audioState}
                connectionState={voiceLive.connectionState}
                isMuted={voiceLive.isMuted}
                onToggleMute={voiceLive.toggleMute}
                onToggleKeyboard={() => setShowKeyboard((v) => !v)}
                onEndSession={stopTest}
                className="py-3"
              />
              {showKeyboard && (
                <div className="flex items-center gap-2 border-t px-4 py-2">
                  <input
                    type="text"
                    value={keyboardText}
                    onChange={(e) => setKeyboardText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && keyboardText.trim()) {
                        void voiceLive.sendTextMessage(keyboardText.trim());
                        setKeyboardText("");
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (keyboardText.trim()) {
                        void voiceLive.sendTextMessage(keyboardText.trim());
                        setKeyboardText("");
                      }
                    }}
                  >
                    Send
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4">
              <Button
                size="lg"
                className="gap-2 min-w-[140px] rounded-full"
                disabled={disabled || isConnecting}
                onClick={startTest}
              >
                <Play className="size-4" />
                {isConnecting
                  ? t("admin:hcp.playgroundStart")
                  : t("admin:hcp.playgroundStart")}
              </Button>
              {disabled && disabledMessage && (
                <p className="text-xs text-muted-foreground">
                  {disabledMessage}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
