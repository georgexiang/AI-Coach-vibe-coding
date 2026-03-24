import { cn } from "@/lib/utils";
import type { ScoreDetail } from "@/types/score";

interface DimensionBarsProps {
  details: ScoreDetail[];
}

function getBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-orange-500";
  return "bg-red-500";
}

export function DimensionBars({ details }: DimensionBarsProps) {
  return (
    <div className="space-y-4">
      {details.map((detail) => (
        <div key={detail.dimension}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm">{detail.dimension}</span>
            <span className="text-sm font-semibold">{detail.score}</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-accent"
            role="progressbar"
            aria-valuenow={detail.score}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                getBarColor(detail.score)
              )}
              style={{ width: `${detail.score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
