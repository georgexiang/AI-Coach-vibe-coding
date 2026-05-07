import { useTranslation } from "react-i18next";
import { Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioOrb } from "@/components/voice/audio-orb";
import type { UnifiedSessionMode } from "@/types/unified-session";
import type { AudioState, VoiceConnectionState } from "@/types/voice-live";

interface VoicePanelProps {
  mode: UnifiedSessionMode;
  voiceConnectionState: VoiceConnectionState;
  audioState: AudioState;
  volumeLevel?: number;
  className?: string;
}

/**
 * Left panel for voice/digital_human mode (D-02).
 * Shows AudioOrb visualization with connection status indicator.
 * Avatar support prepared for digital_human mode.
 */
export function VoicePanel({
  mode: _mode,
  voiceConnectionState,
  audioState,
  volumeLevel = 0,
  className,
}: VoicePanelProps) {
  const { t } = useTranslation("session");

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center bg-slate-900",
        className,
      )}
    >
      {/* Connection status */}
      {voiceConnectionState === "connecting" && (
        <div className="mb-4 flex items-center gap-2 text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t("session.voice.connecting")}</span>
        </div>
      )}

      {voiceConnectionState === "error" && (
        <div className="mb-4 flex items-center gap-2 text-destructive">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm">{t("session.voice.connectionError")}</span>
        </div>
      )}

      {/* Audio visualization */}
      <AudioOrb
        audioState={audioState}
        volumeLevel={volumeLevel}
        className="h-48 w-48"
      />

      {/* Status label */}
      <p className="mt-6 text-sm text-white/60">
        {voiceConnectionState === "connected"
          ? t("session.voice.ready")
          : voiceConnectionState === "disconnected"
            ? t("session.voice.idle")
            : ""}
      </p>
    </div>
  );
}
