import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button, ScrollArea } from "@/components/ui";
import { ScoreSummary } from "@/components/scoring/score-summary";
import { RadarChart } from "@/components/scoring/radar-chart";
import { DimensionBars } from "@/components/scoring/dimension-bars";
import { FeedbackCard } from "@/components/scoring/feedback-card";
import { useSessionScore, useTriggerScoring } from "@/hooks/use-scoring";
import { useSession } from "@/hooks/use-session";

export default function ScoringFeedback() {
  const { t } = useTranslation("scoring");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("id") ?? "";

  const { data: session } = useSession(sessionId || undefined);
  const { data: score, isLoading: scoreLoading } = useSessionScore(
    sessionId || undefined
  );
  const triggerScoring = useTriggerScoring();

  // If session is completed but not scored, trigger scoring
  useEffect(() => {
    if (session?.status === "completed" && !score && !scoreLoading) {
      triggerScoring.mutate(sessionId);
    }
  }, [session?.status, score, scoreLoading, sessionId, triggerScoring]);

  // Loading state while scoring
  if (scoreLoading || triggerScoring.isPending || !score) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {t("scoringInProgress")}
        </p>
      </div>
    );
  }

  const currentScores = score.details.map((d) => ({
    dimension: d.dimension,
    score: d.score,
  }));

  return (
    <div className="mx-auto max-w-7xl p-4 lg:p-8">
      <h1 className="mb-6 text-3xl font-semibold text-gray-900">
        {t("title")}
      </h1>

      {/* Top section: Score summary */}
      <div className="mb-8">
        <ScoreSummary
          overallScore={score.overall_score}
          passed={score.passed}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left: Radar chart + Dimension bars */}
        <div className="space-y-6">
          <RadarChart currentScores={currentScores} />
          <DimensionBars details={score.details} />
        </div>

        {/* Right: Feedback cards */}
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-4">
            {score.details.map((detail) => (
              <FeedbackCard key={detail.dimension} detail={detail} />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom action bar */}
      <div className="mt-8 flex items-center justify-end gap-4 border-t pt-6">
        <Button
          variant="outline"
          onClick={() => navigate("/user/training")}
        >
          {t("tryAgain")}
        </Button>
        <Button variant="outline" disabled>
          {t("exportPdf")}
        </Button>
        <Button variant="outline" disabled>
          {t("shareWithManager")}
        </Button>
        <Button onClick={() => navigate("/user/dashboard")}>
          {t("backToDashboard")}
        </Button>
      </div>
    </div>
  );
}
