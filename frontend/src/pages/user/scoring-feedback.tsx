import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button, ScrollArea } from "@/components/ui";
import { ScoreSummary } from "@/components/scoring/score-summary";
import { RadarChart } from "@/components/scoring/radar-chart";
import { DimensionBars } from "@/components/scoring/dimension-bars";
import { FeedbackCard } from "@/components/scoring/feedback-card";
import { ReportSection } from "@/components/scoring/report-section";
import { useSessionScore, useTriggerScoring, useScoreHistory } from "@/hooks/use-scoring";
import { useSessionReport } from "@/hooks/use-reports";
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

  // Load full report only when score is available
  const { data: report } = useSessionReport(score ? sessionId : undefined);

  // Load score history for RadarChart overlay
  const { data: history } = useScoreHistory(5);
  const previousScores = useMemo(() => {
    if (!history || !sessionId) return undefined;
    const idx = history.findIndex((h) => h.session_id === sessionId);
    const prev = idx >= 0 && idx < history.length - 1 ? history[idx + 1] : undefined;
    if (!prev) return undefined;
    return prev.dimensions.map((d) => ({ dimension: d.dimension, score: d.score }));
  }, [history, sessionId]);

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
      {/* Print stylesheet */}
      <style>{`
        @media print {
          nav, .sidebar, header, footer, .action-bar { display: none !important; }
          .max-w-7xl { max-width: 100% !important; padding: 0 !important; }
          .recharts-wrapper { break-inside: avoid; }
          button { display: none !important; }
        }
      `}</style>

      <h1 className="mb-6 text-3xl font-semibold text-gray-900">
        {t("title")}
      </h1>

      {/* Session metadata */}
      {session && (
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>{t("scenario", { defaultValue: "Scenario" })}: <strong className="text-foreground">{session.scenario_id ?? "—"}</strong></span>
          <span className="text-border">|</span>
          <span>{t("mode", { defaultValue: "Mode" })}: <strong className="text-foreground">F2F</strong></span>
          <span className="text-border">|</span>
          <span>{t("date", { defaultValue: "Date" })}: <strong className="text-foreground">{session.created_at ? new Date(session.created_at).toLocaleDateString() : "—"}</strong></span>
        </div>
      )}

      {/* Top section: Circular progress + Score summary */}
      <div className="mb-8 flex items-center gap-8">
        {/* Circular progress ring */}
        <div className="relative flex-shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="8"
            />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke={score.overall_score >= 80 ? "#059669" : score.overall_score >= 60 ? "#D97706" : "#DC2626"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(score.overall_score / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
              transform="rotate(-90 60 60)"
            />
            <text x="60" y="55" textAnchor="middle" className="fill-foreground text-2xl font-bold" fontSize="28" fontWeight="700">
              {score.overall_score}
            </text>
            <text x="60" y="75" textAnchor="middle" className="fill-muted-foreground" fontSize="12">
              / 100
            </text>
          </svg>
        </div>
        <div className="flex-1">
          <ScoreSummary
            overallScore={score.overall_score}
            passed={score.passed}
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left: Radar chart + Dimension bars */}
        <div className="space-y-6">
          <RadarChart currentScores={currentScores} previousScores={previousScores} />
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

      {/* Report: Improvement priorities and key messages */}
      {report && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">{t("report.improvementTitle")}</h2>
          <ReportSection
            improvements={report.improvements}
            keyMessagesDelivered={report.key_messages_delivered}
            keyMessagesTotal={report.key_messages_total}
          />
        </div>
      )}

      {/* Bottom action bar */}
      <div className="action-bar mt-8 flex items-center justify-end gap-4 border-t pt-6">
        <Button
          variant="outline"
          onClick={() => navigate("/user/training")}
        >
          {t("tryAgain")}
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
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
