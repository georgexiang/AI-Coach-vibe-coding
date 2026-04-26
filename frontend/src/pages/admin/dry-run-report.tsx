import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Rocket, AlertTriangle, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DryRunConversation } from "@/components/shared/dry-run-conversation";
import { SopCoverageMap } from "@/components/shared/sop-coverage-map";
import { CoverageRingChart } from "@/components/shared/coverage-ring-chart";
import { DryRunScoreSummary } from "@/components/shared/dry-run-score-summary";
import { DryRunIssueCard } from "@/components/shared/dry-run-issue-card";
import { useDryRun, useCreateDryRun } from "@/hooks/use-dry-runs";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function DryRunReportPage() {
  const { id: skillId, runId } = useParams<{ id: string; runId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("skill");

  const { data: dryRun, isLoading, isError, refetch } = useDryRun(skillId, runId);
  const createMutation = useCreateDryRun();

  const handleStartNewRun = () => {
    if (!skillId) return;
    createMutation.mutate(skillId, {
      onSuccess: (newRun) => {
        navigate(`/admin/skills/${skillId}/dry-run/${newRun.id}`);
        toast.success(
          t("dryRun.runCompleteToast", {
            defaultValue: "Dry Run started. View the report for details.",
          }),
        );
      },
      onError: () => {
        toast.error(
          t("dryRun.errors.startFailed", {
            defaultValue: "Failed to start simulation",
          }),
        );
      },
    });
  };

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 flex-1" />
        </div>
        <Skeleton className="h-5 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-[140px]" />
          <Skeleton className="h-[140px]" />
          <Skeleton className="h-[140px]" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  // ---- Error state ----
  if (isError || !dryRun) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/50 py-16">
        <AlertTriangle className="size-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {t("dryRun.errorLoadFailed", {
            defaultValue: "Failed to load Dry Run results.",
          })}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 size-4" />
          {t("dryRun.retry", { defaultValue: "Retry" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---- Header row ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/skills/${skillId}/edit`)}
          >
            <ArrowLeft className="mr-1 size-4" />
            {t("dryRun.backToEditor", { defaultValue: "Back to Editor" })}
          </Button>
          <h1 className="text-2xl font-semibold">
            {t("dryRun.reportTitle", { defaultValue: "Dry Run Report" })}
          </h1>
        </div>
        <Button
          onClick={handleStartNewRun}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <RefreshCw className="mr-2 size-4 animate-spin" />
          ) : (
            <Rocket className="mr-2 size-4" />
          )}
          {t("dryRun.startNewRun", { defaultValue: "Start New Run" })}
        </Button>
      </div>

      {/* ---- Metadata row ---- */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Run #{dryRun.run_number}</span>
        <span className="text-border">|</span>
        <span>{formatDate(dryRun.created_at)}</span>
        <span className="text-border">|</span>
        <span>
          {t("dryRun.durationLabel", { defaultValue: "Duration" })}:{" "}
          {formatDuration(dryRun.duration_seconds)}
        </span>
      </div>

      {/* ---- Summary cards ---- */}
      <DryRunScoreSummary
        score={dryRun.executability_score}
        coveragePercent={dryRun.coverage_percent}
        coveredSteps={dryRun.covered_sop_steps}
        totalSteps={dryRun.total_sop_steps}
        issuesCount={dryRun.issues_count}
      />

      {/* ---- Sub-tabs ---- */}
      <Tabs defaultValue="conversation">
        <TabsList className="w-full bg-muted/60 border">
          <TabsTrigger
            value="conversation"
            className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {t("dryRun.tabConversation", { defaultValue: "Conversation" })}
          </TabsTrigger>
          <TabsTrigger
            value="sop-coverage"
            className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {t("dryRun.tabSopCoverage", { defaultValue: "SOP Coverage" })}
          </TabsTrigger>
          <TabsTrigger
            value="issues"
            className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {t("dryRun.tabIssues", { defaultValue: "Issues" })}
          </TabsTrigger>
        </TabsList>

        {/* Conversation tab */}
        <TabsContent value="conversation" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <DryRunConversation messages={dryRun.messages} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SOP Coverage tab */}
        <TabsContent value="sop-coverage" className="mt-4 space-y-6">
          <div className="flex justify-center">
            <CoverageRingChart
              percent={dryRun.coverage_percent ?? 0}
              covered={dryRun.covered_sop_steps}
              total={dryRun.total_sop_steps}
              size={120}
            />
          </div>
          <Card>
            <CardContent className={cn("p-2")}>
              <SopCoverageMap coverage={dryRun.sop_coverage} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issues tab */}
        <TabsContent value="issues" className="mt-4 space-y-4">
          {dryRun.issues.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center gap-3 p-8">
                <Check className="size-5 text-strength" />
                <p className="text-sm text-foreground">
                  {t("dryRun.noIssues", {
                    defaultValue:
                      "No issues found. The SOP drives a complete and effective conversation.",
                  })}
                </p>
              </CardContent>
            </Card>
          ) : (
            dryRun.issues.map((issue, idx) => (
              <DryRunIssueCard key={idx} issue={issue} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
