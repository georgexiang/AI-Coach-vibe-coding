import { cn } from "@/lib/utils";

interface DimensionBarProps {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
}

export function DimensionBar({
  label,
  value,
  maxValue = 100,
  color,
}: DimensionBarProps) {
  const percentage = Math.min(Math.round((value / maxValue) * 100), 100);
  const barColor = color ?? "bg-primary";
  const trackColor = color ? `${color}/20` : "bg-primary/20";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">
          {percentage}%
        </span>
      </div>
      <div className={cn("h-2 w-full rounded-full", trackColor)}>
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
