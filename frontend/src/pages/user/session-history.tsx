import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { LoadingState, EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useScoreHistory, useTriggerScoring } from "@/hooks/use-scoring";
import { useUserSessions } from "@/hooks/use-session";
import type { CoachingSession } from "@/types/session";

const ALL_VALUE = "__all__";
const PAGE_SIZE = 10;

/** Unified row item combining scored history items and unscored sessions */
interface UnifiedHistoryRow {
  session_id: string;
  scenario_name: string;
  status: "created" | "in_progress" | "completed" | "scoring" | "scored";
  completed_at: string | null;
  created_at: string | null;
  duration_seconds: number | null;
  message_count: number;
  // Only for scored sessions
  overall_score: number | null;
  passed: boolean | null;
  dimensions: Array<{
    dimension: string;
    score: number;
    weight: number;
    improvement_pct: number | null;
  }>;
}

export default function SessionHistory() {
  const { t } = useTranslation("scoring");
  const navigate = useNavigate();
  const { data: history, isLoading: isLoadingHistory } = useScoreHistory(50);
  const { data: sessionsData, isLoading: isLoadingSessions } = useUserSessions({ page: 1, page_size: 100 });
  const triggerScoringMutation = useTriggerScoring();

  // Track which sessions are currently being scored (optimistic UI)
  const [scoringSessionIds, setScoringSessionIds] = useState<Set<string>>(new Set());

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);
  const [scoreFilter, setScoreFilter] = useState(ALL_VALUE);
  const [page, setPage] = useState(1);

  const isLoading = isLoadingHistory || isLoadingSessions;

  // Build unified rows: combine scored history + completed-but-not-scored sessions
  const unifiedRows: UnifiedHistoryRow[] = useMemo(() => {
    const rows: UnifiedHistoryRow[] = [];
    const scoredSessionIds = new Set<string>();

    // Add scored sessions from history
    if (history) {
      for (const item of history) {
        scoredSessionIds.add(item.session_id);
        rows.push({
          session_id: item.session_id,
          scenario_name: item.scenario_name,
          status: "scored",
          completed_at: item.completed_at,
          created_at: item.completed_at,
          duration_seconds: null,
          message_count: 0,
          overall_score: item.overall_score,
          passed: item.passed,
          dimensions: item.dimensions,
        });
      }
    }

    // Add all non-scored sessions (created, in_progress, completed)
    if (sessionsData?.items) {
      for (const session of sessionsData.items) {
        if (!scoredSessionIds.has(session.id)) {
          let rowStatus: UnifiedHistoryRow["status"];
          if (scoringSessionIds.has(session.id)) {
            rowStatus = "scoring";
          } else if (session.status === "completed") {
            rowStatus = "completed";
          } else if (session.status === "in_progress") {
            rowStatus = "in_progress";
          } else {
            rowStatus = "created";
          }
          rows.push({
            session_id: session.id,
            scenario_name: session.scenario_name || session.scenario_id,
            status: rowStatus,
            completed_at: session.completed_at,
            created_at: session.created_at,
            duration_seconds: session.duration_seconds,
            message_count: session.message_count,
            overall_score: null,
            passed: null,
            dimensions: [],
          });
        }
      }
    }

    // Sort by completed_at (or created_at as fallback) descending (most recent first)
    rows.sort((a, b) => {
      const dateA = new Date(a.completed_at || a.created_at || "").getTime() || 0;
      const dateB = new Date(b.completed_at || b.created_at || "").getTime() || 0;
      return dateB - dateA;
    });

    return rows;
  }, [history, sessionsData, scoringSessionIds]);

  // Also merge duration/message_count from sessions into scored rows
  const enrichedRows: UnifiedHistoryRow[] = useMemo(() => {
    if (!sessionsData?.items) return unifiedRows;
    const sessionMap = new Map<string, CoachingSession>();
    for (const s of sessionsData.items) {
      sessionMap.set(s.id, s);
    }
    return unifiedRows.map((row) => {
      const session = sessionMap.get(row.session_id);
      if (session && row.status === "scored") {
        return {
          ...row,
          duration_seconds: row.duration_seconds ?? session.duration_seconds,
          message_count: row.message_count || session.message_count,
        };
      }
      return row;
    });
  }, [unifiedRows, sessionsData]);

  // Filter logic
  const filteredRows = useMemo(() => {
    return enrichedRows.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        item.scenario_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === ALL_VALUE ||
        (statusFilter === "created" && item.status === "created") ||
        (statusFilter === "in_progress" && item.status === "in_progress") ||
        (statusFilter === "completed" && item.status === "completed") ||
        (statusFilter === "scoring" && item.status === "scoring") ||
        (statusFilter === "scored" && item.status === "scored");
      const matchesScore =
        scoreFilter === ALL_VALUE ||
        (scoreFilter === "high" && item.overall_score != null && item.overall_score >= 80) ||
        (scoreFilter === "mid" && item.overall_score != null && item.overall_score >= 60 && item.overall_score < 80) ||
        (scoreFilter === "low" && item.overall_score != null && item.overall_score < 60) ||
        // Show unscored sessions when no score filter is applied via "all"
        (item.overall_score == null && scoreFilter === ALL_VALUE);
      return matchesSearch && matchesStatus && matchesScore;
    });
  }, [enrichedRows, searchTerm, statusFilter, scoreFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  // Handle submit scoring
  const handleSubmitScoring = useCallback(
    (sessionId: string) => {
      setScoringSessionIds((prev) => new Set([...prev, sessionId]));
      triggerScoringMutation.mutate(sessionId, {
        onSuccess: () => {
          // After scoring completes, the score history will refresh automatically
          setScoringSessionIds((prev) => {
            const next = new Set(prev);
            next.delete(sessionId);
            return next;
          });
        },
        onError: () => {
          setScoringSessionIds((prev) => {
            const next = new Set(prev);
            next.delete(sessionId);
            return next;
          });
        },
      });
    },
    [triggerScoringMutation],
  );

  // Format duration
  const formatDuration = (seconds: number | null): string => {
    if (seconds == null) return "--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };


  // Status badge renderer
  const renderStatusBadge = (item: UnifiedHistoryRow) => {
    switch (item.status) {
      case "created":
        return (
          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
            {t("history.statusCreated")}
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            {t("history.statusInProgress")}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            {t("history.statusPending")}
          </Badge>
        );
      case "scoring":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Loader2 className="mr-1 inline size-3 animate-spin" />
            {t("history.statusScoring")}
          </Badge>
        );
      case "scored":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {t("history.statusScored")}
          </Badge>
        );
    }
  };

  // Score cell renderer
  const renderScoreCell = (item: UnifiedHistoryRow) => {
    if (item.status === "created" || item.status === "in_progress") {
      return <span className="text-sm text-muted-foreground">--</span>;
    }
    if (item.status === "completed") {
      return (
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={(e) => {
            e.stopPropagation();
            handleSubmitScoring(item.session_id);
          }}
        >
          {t("history.submitScoring")}
        </Button>
      );
    }
    if (item.status === "scoring") {
      return (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {t("history.scoringInProgress")}
        </span>
      );
    }
    // scored
    if (item.overall_score != null) {
      return (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-7 w-10 items-center justify-center rounded text-xs font-semibold",
              item.overall_score >= 80
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : item.overall_score >= 60
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            )}
          >
            {item.overall_score}
          </span>
          <Badge
            className={cn(
              "text-xs",
              item.passed
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            )}
          >
            {item.passed ? t("passed") : t("failed")}
          </Badge>
        </div>
      );
    }
    return <span className="text-sm text-muted-foreground">--</span>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-medium text-foreground">{t("history.title")}</h1>
        <LoadingState variant="table" />
      </div>
    );
  }

  if (enrichedRows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-medium text-foreground">{t("history.title")}</h1>
        <EmptyState
          title={t("history.noSessions")}
          body={t("history.noSessionsBody")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-foreground">{t("history.title")}</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("history.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>
              {t("history.allStatuses")}
            </SelectItem>
            <SelectItem value="created">{t("history.statusCreated")}</SelectItem>
            <SelectItem value="in_progress">{t("history.statusInProgress")}</SelectItem>
            <SelectItem value="completed">{t("history.statusPending")}</SelectItem>
            <SelectItem value="scoring">{t("history.statusScoring")}</SelectItem>
            <SelectItem value="scored">{t("history.statusScored")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scoreFilter} onValueChange={handleFilterChange(setScoreFilter)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>
              {t("history.allScores")}
            </SelectItem>
            <SelectItem value="high">
              {t("history.scoreHigh")}
            </SelectItem>
            <SelectItem value="mid">
              {t("history.scoreMid")}
            </SelectItem>
            <SelectItem value="low">
              {t("history.scoreLow")}
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredRows.length} {t("history.results")}
        </span>
      </div>

      {/* History table -- desktop */}
      <div className="hidden rounded-lg border border-border bg-card sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {t("history.date")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {t("history.scenario")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {t("history.status")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {t("history.score")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {t("history.duration")}
              </th>
              <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground lg:table-cell">
                {t("history.messages")}
              </th>
              <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground xl:table-cell">
                {t("rubrics.dimensions", { ns: "admin" })}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                {t("history.viewDetails")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((item) => (
              <tr
                key={item.session_id}
                className={cn(
                  "border-b border-border transition-colors hover:bg-muted/50",
                  item.status === "scored" && "cursor-pointer",
                )}
                onClick={() => {
                  if (item.status === "scored") {
                    navigate(`/user/scoring/${item.session_id}`);
                  }
                }}
              >
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {item.completed_at
                    ? new Date(item.completed_at).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {item.scenario_name}
                </td>
                <td className="px-4 py-3">
                  {renderStatusBadge(item)}
                </td>
                <td className="px-4 py-3">
                  {renderScoreCell(item)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDuration(item.duration_seconds)}
                </td>
                <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                  {item.message_count > 0 ? `${item.message_count} ${t("history.messages")}` : "--"}
                </td>
                <td className="hidden px-4 py-3 xl:table-cell">
                  {item.status === "scored" && item.dimensions.length > 0 ? (
                    <div className="flex items-center gap-2">
                      {item.dimensions.slice(0, 3).map((dim) => (
                        <div
                          key={dim.dimension}
                          className="flex items-center gap-1"
                        >
                          <div className="h-1.5 w-8 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                dim.score >= 80
                                  ? "bg-green-500"
                                  : dim.score >= 60
                                    ? "bg-orange-500"
                                    : "bg-red-500",
                              )}
                              style={{ width: `${dim.score}%` }}
                            />
                          </div>
                          {dim.improvement_pct != null && dim.improvement_pct !== 0 && (
                            <span
                              className={cn(
                                "text-xs",
                                dim.improvement_pct > 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400",
                              )}
                            >
                              {dim.improvement_pct > 0 ? (
                                <TrendingUp className="inline size-3" />
                              ) : (
                                <TrendingDown className="inline size-3" />
                              )}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">--</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {item.status === "scored" ? (
                    <span className="text-sm text-primary transition-colors duration-150 hover:underline">
                      {t("history.viewDetails")}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("history.previous")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("history.next")}
            </Button>
          </div>
        )}
      </div>

      {/* History cards -- mobile */}
      <div className="space-y-3 sm:hidden">
        {pagedRows.map((item) => (
          <div
            key={item.session_id}
            className={cn(
              "rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50",
              item.status === "scored" && "cursor-pointer",
            )}
            onClick={() => {
              if (item.status === "scored") {
                navigate(`/user/scoring/${item.session_id}`);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {item.scenario_name}
              </span>
              {renderStatusBadge(item)}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {item.completed_at
                  ? new Date(item.completed_at).toLocaleDateString()
                  : "-"}
              </span>
              <span>{formatDuration(item.duration_seconds)}</span>
              {item.message_count > 0 && (
                <span>{item.message_count} {t("history.messages")}</span>
              )}
            </div>
            <div className="mt-3">
              {renderScoreCell(item)}
            </div>
          </div>
        ))}

        {/* Mobile pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("history.previous")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("history.next")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
