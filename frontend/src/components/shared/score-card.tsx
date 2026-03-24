import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  score: number;
  label: string;
  trend?: { value: string; direction: "up" | "down" };
  chart?: React.ReactNode;
}

function MiniBarChart() {
  const bars = [60, 80, 45, 90, 70];

  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      {bars.map((height, i) => (
        <rect
          key={i}
          x={4 + i * 9}
          y={48 - (height / 100) * 40}
          width="6"
          rx="1"
          height={(height / 100) * 40}
          fill="var(--primary)"
          opacity={0.6 + (i / bars.length) * 0.4}
        />
      ))}
    </svg>
  );
}

export function ScoreCard({ score, label, trend, chart }: ScoreCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 p-6">
        <div className="h-full w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />

        <div className="min-w-0 flex-1">
          <p className="text-4xl font-semibold text-foreground">{score}</p>
          <p className="text-sm text-muted-foreground">{label}</p>

          {trend && (
            <div className="mt-1 flex items-center gap-1">
              {trend.direction === "up" ? (
                <TrendingUp className="size-3.5 text-strength" />
              ) : (
                <TrendingDown className="size-3.5 text-destructive" />
              )}
              <span
                className={cn(
                  "text-xs font-medium",
                  trend.direction === "up"
                    ? "text-strength"
                    : "text-destructive",
                )}
              >
                {trend.value}
              </span>
            </div>
          )}
        </div>

        <div className="shrink-0">{chart ?? <MiniBarChart />}</div>
      </CardContent>
    </Card>
  );
}
