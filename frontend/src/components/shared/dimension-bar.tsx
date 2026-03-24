import { cn } from "@/lib/utils";

interface DimensionBarProps {
  label: string;
  value: number;
  maxValue?: number;
}

export function DimensionBar({
  label,
  value,
  maxValue = 100,
}: DimensionBarProps) {
  const percentage = Math.min(Math.round((value / maxValue) * 100), 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className={cn("text-sm font-medium text-foreground")}>
          {percentage}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-primary/20">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
