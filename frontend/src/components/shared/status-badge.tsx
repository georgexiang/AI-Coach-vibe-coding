import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "delivered" | "in-progress" | "pending";
  label: string;
}

const dotColorMap: Record<StatusBadgeProps["status"], string> = {
  delivered: "bg-strength",
  "in-progress": "bg-chart-3",
  pending: "bg-muted-foreground",
};

const textColorMap: Record<StatusBadgeProps["status"], string> = {
  delivered: "text-strength",
  "in-progress": "text-chart-3",
  pending: "text-muted-foreground",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", dotColorMap[status])} />
      <span className={cn("text-sm", textColorMap[status])}>{label}</span>
    </span>
  );
}
