import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2 } from "lucide-react";
import apiClient from "@/api/client";
import { cn } from "@/lib/utils";

interface AudioEvidencePlayerProps {
  audioUrl: string;
  label?: string;
  className?: string;
}

/**
 * Audio playback component for voice scoring evidence (D-11).
 * Uses native HTML5 audio element with controls.
 */
export function AudioEvidencePlayer({
  audioUrl,
  label,
  className,
}: AudioEvidencePlayerProps) {
  const { t } = useTranslation("scoring");
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadAudio() {
      try {
        const { data } = await apiClient.get<Blob>(audioUrl, {
          responseType: "blob",
        });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setPlaybackUrl(objectUrl);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load session audio", error);
        setLoadFailed(true);
      }
    }

    setPlaybackUrl(null);
    setLoadFailed(false);
    void loadAudio();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-muted/30 p-3",
        className,
      )}
      data-testid="audio-evidence-player"
    >
      <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
      <audio
        controls
        preload="metadata"
        className="h-8 min-w-0 flex-1"
        data-testid="audio-element"
        aria-label={loadFailed ? t("voiceScore.audioLoadFailed") : undefined}
      >
        {playbackUrl && <source src={playbackUrl} type="audio/webm" />}
        {t("voiceScore.audioNotSupported")}
      </audio>
      {loadFailed && (
        <span className="text-sm text-danger-600">
          {t("voiceScore.audioLoadFailed")}
        </span>
      )}
    </div>
  );
}
