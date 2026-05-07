import { useTranslation } from "react-i18next";
import { Mic, TrendingUp } from "lucide-react";
import { AudioEvidencePlayer } from "./audio-evidence-player";
import type { ScoreDimension } from "@/hooks/use-combined-score";

interface VoiceScoreSectionProps {
  dimensions: ScoreDimension[];
  overallVoiceScore: number;
  voiceScoreStatus: string;
  audioUrl: string | null;
}

/**
 * Voice scoring section for the combined report page (D-09, D-11).
 * Shows voice-specific dimensions with scores, feedback, and audio evidence.
 */
export function VoiceScoreSection({
  dimensions,
  overallVoiceScore,
  voiceScoreStatus,
  audioUrl,
}: VoiceScoreSectionProps) {
  const { t } = useTranslation("scoring");

  if (voiceScoreStatus === "none") return null;

  if (voiceScoreStatus === "pending" || voiceScoreStatus === "processing") {
    return (
      <div className="rounded-lg border p-6" data-testid="voice-score-section">
        <div className="mb-4 flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t("voiceScore.title")}</h3>
        </div>
        <p className="animate-pulse text-sm text-muted-foreground">
          {t("voiceScore.processing")}
        </p>
      </div>
    );
  }

  if (voiceScoreStatus === "failed") {
    return (
      <div className="rounded-lg border p-6" data-testid="voice-score-section">
        <div className="mb-4 flex items-center gap-2">
          <Mic className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">{t("voiceScore.title")}</h3>
        </div>
        <p className="text-sm text-destructive">{t("voiceScore.failed")}</p>
      </div>
    );
  }

  return (
    <div
      className="space-y-4 rounded-lg border p-6"
      data-testid="voice-score-section"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t("voiceScore.title")}</h3>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-2xl font-bold">{overallVoiceScore}</span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
      </div>

      {/* Audio evidence player (D-11) */}
      {audioUrl && (
        <AudioEvidencePlayer
          audioUrl={audioUrl}
          label={t("voiceScore.sessionRecording")}
        />
      )}

      {/* Dimension scores */}
      <div className="grid gap-3">
        {dimensions.map((dim) => (
          <div key={dim.dimension} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t(`voiceScore.dimensions.${dim.dimension}`)}
              </span>
              <span className="text-sm font-bold">
                {dim.score}/100
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${dim.score}%` }}
                data-testid={`voice-bar-${dim.dimension}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
