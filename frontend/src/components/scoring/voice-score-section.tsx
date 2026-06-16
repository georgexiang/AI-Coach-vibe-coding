import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, TrendingUp, RefreshCw } from "lucide-react";
import { AudioEvidencePlayer } from "./audio-evidence-player";
import type { ScoreDimension } from "@/hooks/use-combined-score";
import apiClient from "@/api/client";

interface VoiceScoreSectionProps {
  dimensions: ScoreDimension[];
  overallVoiceScore: number;
  voiceScoreStatus: string;
  audioUrl: string | null;
  sessionId?: string;
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
  sessionId,
}: VoiceScoreSectionProps) {
  const { t } = useTranslation("scoring");
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(voiceScoreStatus);

  useEffect(() => {
    setLocalStatus(voiceScoreStatus);
  }, [voiceScoreStatus]);

  const handleRetry = async () => {
    if (!sessionId) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await apiClient.post(`/sessions/${sessionId}/voice-score/retry`);
      setLocalStatus("processing");
      await queryClient.invalidateQueries({ queryKey: ["combined-score", sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["voice-score", sessionId] });
      setRetrying(false);
    } catch {
      setRetryError(t("voiceScore.retryFailed"));
      setRetrying(false);
    }
  };

  if (localStatus === "none") return null;

  if (localStatus === "pending" || localStatus === "processing") {
    return (
      <div className="rounded-lg border p-6" data-testid="voice-score-section">
        <div className="mb-4 flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t("voiceScore.title")}</h3>
        </div>
        <p className="animate-pulse text-sm text-muted-foreground">
          {t("voiceScore.processing")}
        </p>
        {localStatus === "pending" && sessionId && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            data-testid="retry-voice-scoring"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? t("voiceScore.retrying") : t("voiceScore.retry")}
          </button>
        )}
        {retryError && <p className="mt-2 text-xs text-destructive">{retryError}</p>}
      </div>
    );
  }

  if (localStatus === "failed") {
    return (
      <div className="rounded-lg border p-6" data-testid="voice-score-section">
        <div className="mb-4 flex items-center gap-2">
          <Mic className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">{t("voiceScore.title")}</h3>
        </div>
        <p className="text-sm text-destructive">{t("voiceScore.failed")}</p>
        {sessionId && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            data-testid="retry-voice-scoring"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? t("voiceScore.retrying") : t("voiceScore.retry")}
          </button>
        )}
        {retryError && <p className="mt-2 text-xs text-destructive">{retryError}</p>}
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
