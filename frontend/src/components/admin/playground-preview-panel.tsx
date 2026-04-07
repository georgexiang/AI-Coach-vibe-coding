import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Play, Square, RefreshCw, Mic, MicOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarView } from "@/components/voice/avatar-view";
import { AudioOrb } from "@/components/voice/audio-orb";
import { useVoiceLive } from "@/hooks/use-voice-live";
import { useAvatarStream } from "@/hooks/use-avatar-stream";
import { useAudioHandler } from "@/hooks/use-audio-handler";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import type { TranscriptSegment, AudioState } from "@/types/voice-live";

const MAX_TRANSCRIPTS = 100;

type SessionState = "idle" | "connecting" | "connected" | "error" | "stopping";

interface PlaygroundPreviewPanelProps {
  hcpProfileId?: string;
  vlInstanceId?: string;
  systemPrompt?: string;
  avatarCharacter?: string;
  avatarStyle?: string;
  avatarEnabled: boolean;
  disabled?: boolean;
}

export function PlaygroundPreviewPanel({
  hcpProfileId,
  vlInstanceId,
  systemPrompt,
  avatarCharacter,
  avatarStyle,
  avatarEnabled,
  disabled,
}: PlaygroundPreviewPanelProps) {
  const { t } = useTranslation(["admin"]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptPanelRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>("idle");

  const audioHandler = useAudioHandler();
  const audioPlayer = useAudioPlayer();
  const avatarStream = useAvatarStream(videoRef);

  const onTranscript = useCallback((seg: TranscriptSegment) => {
    setTranscripts((prev) => {
      const idx = prev.findIndex((s) => s.id === seg.id);
      let next: TranscriptSegment[];
      if (idx >= 0) {
        next = [...prev];
        const existing = next[idx]!;
        if (!seg.isFinal && !existing.isFinal) {
          next[idx] = { ...seg, content: existing.content + seg.content };
        } else {
          next[idx] = seg;
        }
      } else {
        next = [...prev, seg];
      }
      if (next.length > MAX_TRANSCRIPTS) {
        next = next.slice(next.length - MAX_TRANSCRIPTS);
      }
      return next;
    });
  }, []);

  const onError = useCallback(
    (err: Error) => {
      toast.error(err.message);
      setSessionState("error");
    },
    [],
  );

  const voiceLive = useVoiceLive({
    language: "auto",
    systemPrompt: systemPrompt ?? "",
    onTranscript,
    onAudioDelta: audioPlayer.playAudio,
    onError,
  });

  // Derive audioState for sub-components
  const audioState: AudioState = voiceLive.audioState;

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
        systemPrompt ?? "",
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

  // Cleanup on unmount (tab switch, navigation, profile change)
  useEffect(() => {
    return () => {
      voiceLive.disconnect().catch(() => { /* ignore */ });
      avatarStream.disconnect();
      audioHandler.cleanup();
      audioPlayer.stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If hcpProfileId or vlInstanceId changes while connected, force disconnect
  useEffect(() => {
    if (sessionState === "connected" || sessionState === "connecting") {
      void stopTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hcpProfileId, vlInstanceId]);

  // Auto-scroll transcript panel (pause when user scrolls up)
  const handleTranscriptScroll = () => {
    const el = transcriptPanelRef.current;
    if (!el) return;
    userScrolledRef.current = el.scrollTop + el.clientHeight < el.scrollHeight - 20;
  };

  useEffect(() => {
    if (!userScrolledRef.current && transcriptPanelRef.current) {
      transcriptPanelRef.current.scrollTop = transcriptPanelRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          {t("admin:hcp.playgroundTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avatar/Orb area */}
        <div className="flex items-center justify-center min-h-[240px] bg-muted/30 rounded-lg">
          {avatarEnabled && avatarCharacter ? (
            <AvatarView
              videoRef={videoRef}
              avatarCharacter={avatarCharacter}
              avatarStyle={avatarStyle ?? ""}
              isAvatarConnected={sessionState === "connected"}
              audioState={audioState}
              isConnecting={sessionState === "connecting"}
              hcpName=""
              isFullScreen={false}
            />
          ) : (
            <AudioOrb audioState={audioState} />
          )}
        </div>

        {/* Start/Stop + Mute Controls */}
        <div className="flex flex-col items-center gap-2">
          {sessionState !== "connected" && sessionState !== "stopping" ? (
            <Button
              onClick={startTest}
              disabled={disabled || !vlInstanceId || sessionState === "connecting"}
              className="min-w-[120px]"
              aria-label={t("admin:hcp.playgroundStart")}
            >
              {sessionState === "connecting" ? (
                <RefreshCw className="size-4 mr-2 animate-spin" />
              ) : (
                <Play className="size-4 mr-2" />
              )}
              {t("admin:hcp.playgroundStart")}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={stopTest}
              disabled={sessionState === "stopping"}
              className="min-w-[120px]"
              aria-label={t("admin:hcp.playgroundStop")}
            >
              <Square className="size-4 mr-2" />
              {t("admin:hcp.playgroundStop")}
            </Button>
          )}
          {sessionState === "connected" && (
            <Button
              variant="outline"
              size="sm"
              onClick={voiceLive.toggleMute}
              aria-label={voiceLive.isMuted ? "Unmute" : "Mute"}
            >
              {voiceLive.isMuted ? (
                <MicOff className="size-4 mr-1" />
              ) : (
                <Mic className="size-4 mr-1" />
              )}
              {voiceLive.isMuted ? "Unmute" : "Mute"}
            </Button>
          )}
        </div>

        {/* Disabled helper text */}
        {disabled && (
          <p className="text-xs text-muted-foreground text-center">
            {t("admin:hcp.playgroundDisabledNew")}
          </p>
        )}
        {!disabled && !vlInstanceId && (
          <p className="text-xs text-muted-foreground text-center">
            {t("admin:hcp.playgroundDisabledNoVl")}
          </p>
        )}

        {/* Transcript area */}
        <div
          ref={transcriptPanelRef}
          className="bg-muted/30 rounded p-3 max-h-[200px] overflow-y-auto space-y-2"
          role="log"
          aria-live="polite"
          onScroll={handleTranscriptScroll}
        >
          {transcripts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center">...</p>
          ) : (
            transcripts.map((seg) => (
              <div key={seg.id} className="text-xs">
                <span className="font-semibold">
                  {seg.role === "user"
                    ? t("admin:hcp.transcriptUser")
                    : t("admin:hcp.transcriptAgent")}
                  :
                </span>{" "}
                {seg.content}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
