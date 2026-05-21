import { useTranslation } from "react-i18next";
import { Volume2 } from "lucide-react";
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
      >
        <source src={audioUrl} type="audio/webm" />
        {t("voiceScore.audioNotSupported")}
      </audio>
    </div>
  );
}
