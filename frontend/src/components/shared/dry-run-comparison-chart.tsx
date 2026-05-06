import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { DryRunListItem } from "@/types/dry-run";

interface ChartDataPoint {
  id: string;
  run_number: number;
  score: number;
  coverage: number;
}

interface DryRunComparisonChartProps {
  runs: DryRunListItem[];
  onRunClick?: (runId: string) => void;
}

export function DryRunComparisonChart({
  runs,
  onRunClick,
}: DryRunComparisonChartProps) {
  const { t } = useTranslation("skill");

  const handleClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any) => {
      const payload = state?.activePayload?.[0]?.payload as
        | ChartDataPoint
        | undefined;
      if (payload?.id && onRunClick) {
        onRunClick(payload.id);
      }
    },
    [onRunClick],
  );

  if (runs.length < 2) {
    return null;
  }

  const sortedRuns = [...runs].sort(
    (a, b) => a.run_number - b.run_number,
  );

  const chartData: ChartDataPoint[] = sortedRuns.map((run) => ({
    id: run.id,
    run_number: run.run_number,
    score: run.executability_score ?? 0,
    coverage: run.coverage_percent ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} onClick={handleClick}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="run_number"
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickFormatter={(val: number) => `#${val}`}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const first = payload[0];
            if (!first) return null;
            const data = first.payload as ChartDataPoint;
            return (
              <div className="rounded-md border bg-card p-2 text-sm shadow-sm">
                <p className="font-medium">
                  Run #{data.run_number}
                </p>
                <p>
                  {t("dryRun.score")}: {data.score}
                </p>
                <p>
                  {t("dryRun.coverage")}:{" "}
                  {data.coverage}%
                </p>
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="var(--primary, #1E40AF)"
          strokeWidth={2}
          name={t("dryRun.score")}
          dot={{ r: 4, cursor: "pointer" }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="coverage"
          stroke="var(--chart-2, #06B6D4)"
          strokeWidth={2}
          name={t("dryRun.coverage")}
          dot={{ r: 4, cursor: "pointer" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
