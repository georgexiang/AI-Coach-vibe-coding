import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, Progress } from "@/components/ui";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  colorClass?: string;
  trend?: { value: string; direction: "up" | "down" };
  chart?: React.ReactNode;
  progress?: { current: number; total: number };
}

export function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  trend,
  chart,
  progress,
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          {Icon && (
            <div className={cn("flex size-10 items-center justify-center rounded-lg", colorClass ?? "bg-primary/10")}>
              <Icon className={cn("size-5", colorClass ? "" : "text-primary")} />
            </div>
          )}
          {chart && <div className="ml-auto">{chart}</div>}
        </div>

        <div className="mt-3">
          <p className="text-3xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>

        {trend && (
          <div className="mt-2 flex items-center gap-1">
            {trend.direction === "up" ? (
              <TrendingUp className="size-4 text-strength" />
            ) : (
              <TrendingDown className="size-4 text-destructive" />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                trend.direction === "up"
                  ? "text-strength"
                  : "text-destructive",
              )}
            >
              {trend.value}
            </span>
          </div>
        )}

        {progress && (
          <div className="mt-3 space-y-1">
            <Progress
              value={(progress.current / progress.total) * 100}
            />
            <p className="text-xs text-muted-foreground">
              {progress.current} of {progress.total} goal
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
